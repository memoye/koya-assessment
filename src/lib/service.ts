import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getPool, pgErrorCode, withTransaction } from "./db";
import type { ApiResult, Booking, Slot, SlotWithAvailability } from "./types";
import { normalizeEmail, parseLimit, validateNewBooking, validateResetBody } from "./validation";

export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

const err = (status: number, error: string, headers?: Record<string, string>) => ({
  status,
  body: { error },
  headers,
});

type BookingRow = {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: Date;
};

const BOOKING_COLUMNS = "id, slot_id, name, email, status, created_at";

function toBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    slot_id: r.slot_id,
    name: r.name,
    email: r.email,
    status: r.status,
    created_at: r.created_at.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Level 1: reset & slots                                             */
/* ------------------------------------------------------------------ */

export async function resetSlots(body: unknown): Promise<ApiResult<{ ok: true; slots: number }>> {
  const v = validateResetBody(body);
  if (!v.ok) return err(400, v.error);
  const slots = v.value;

  await withTransaction(async (c) => {
    // Bookings, idempotency records and rate-limit counters all describe the
    // old world; reset starts a clean one.
    await c.query("TRUNCATE bookings, idempotency_keys, booking_attempts, slots RESTART IDENTITY");
    if (slots.length > 0) {
      await c.query(
        `INSERT INTO slots (id, provider, start_at, end_at, start_raw, end_raw)
         SELECT * FROM unnest($1::text[], $2::text[], $3::timestamptz[], $4::timestamptz[], $5::text[], $6::text[])`,
        [
          slots.map((s) => s.id),
          slots.map((s) => s.provider),
          slots.map((s) => new Date(s.start).toISOString()),
          slots.map((s) => new Date(s.end).toISOString()),
          slots.map((s) => s.start),
          slots.map((s) => s.end),
        ],
      );
    }
  });

  return { status: 200, body: { ok: true, slots: slots.length } };
}

export async function listSlots(provider: string | null): Promise<SlotWithAvailability[]> {
  const { rows } = await getPool().query<{
    id: string;
    provider: string;
    start_raw: string;
    end_raw: string;
    available: boolean;
  }>(
    `SELECT s.id, s.provider, s.start_raw, s.end_raw,
            NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS available
       FROM slots s
      WHERE $1::text IS NULL OR s.provider = $1
      ORDER BY s.start_at, s.id`,
    [provider],
  );
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    start: r.start_raw,
    end: r.end_raw,
    available: r.available,
  }));
}

// For the web UI. A slot is bookable when it hasn't started and has no confirmed booking.
const BOOKABLE = `s.start_at > now() AND NOT EXISTS (
  SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed')`;

/** Every bookable slot, earliest first. */
export async function listBookableSlots(): Promise<Slot[]> {
  const { rows } = await getPool().query<Slot>(
    `SELECT s.id, s.provider, s.start_raw AS start, s.end_raw AS end
       FROM slots s WHERE ${BOOKABLE} ORDER BY s.start_at, s.id`,
  );
  return rows;
}

/** One slot and whether it can still be booked (null if it doesn't exist). */
export async function getSlot(id: string): Promise<(Slot & { bookable: boolean }) | null> {
  const { rows } = await getPool().query<Slot & { bookable: boolean }>(
    `SELECT s.id, s.provider, s.start_raw AS start, s.end_raw AS end, ${BOOKABLE} AS bookable
       FROM slots s WHERE s.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Slot details keyed by id. */
export async function getSlotsByIds(ids: string[]): Promise<Map<string, Slot>> {
  if (ids.length === 0) return new Map();
  const { rows } = await getPool().query<Slot>(
    `SELECT id, provider, start_raw AS start, end_raw AS end FROM slots WHERE id = ANY($1::text[])`,
    [ids],
  );
  return new Map(rows.map((s) => [s.id, s]));
}

/* ------------------------------------------------------------------ */
/* Level 1 & 3: get / cancel                                          */
/* ------------------------------------------------------------------ */

export async function getBooking(id: string): Promise<ApiResult<Booking>> {
  const { rows } = await getPool().query<BookingRow>(
    `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) return err(404, "booking not found");
  return { status: 200, body: toBooking(rows[0]) };
}

export async function cancelBooking(id: string): Promise<ApiResult<Booking>> {
  // A single conditional UPDATE: two concurrent cancels can't both succeed.
  const { rows } = await getPool().query<BookingRow>(
    `UPDATE bookings SET status = 'cancelled', cancelled_at = now()
      WHERE id = $1 AND status = 'confirmed'
      RETURNING ${BOOKING_COLUMNS}`,
    [id],
  );
  if (rows.length > 0) return { status: 200, body: toBooking(rows[0]) };

  const existing = await getPool().query("SELECT 1 FROM bookings WHERE id = $1", [id]);
  return existing.rowCount ? err(409, "booking is already cancelled") : err(404, "booking not found");
}

/* ------------------------------------------------------------------ */
/* Level 4: list a person's bookings (cursor pagination)              */
/* ------------------------------------------------------------------ */

const encodeCursor = (seq: string) => Buffer.from(`v1:${seq}`).toString("base64url");

function decodeCursor(cursor: string): string | null {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const m = /^v1:(\d{1,18})$/.exec(decoded);
  return m ? m[1] : null;
}

export async function listBookings(params: {
  email: string | null;
  limit: string | null;
  cursor: string | null;
}): Promise<ApiResult<{ bookings: Booking[]; next_cursor: string | null }>> {
  const email = params.email ? normalizeEmail(params.email) : "";
  if (!email) return err(400, "email is required");

  const limit = parseLimit(params.limit);
  if (!limit.ok) return err(400, limit.error);

  let afterSeq = "0";
  if (params.cursor !== null && params.cursor !== "") {
    const seq = decodeCursor(params.cursor);
    if (seq === null) return err(400, "invalid cursor");
    afterSeq = seq;
  }

  // Keyset pagination on the insertion sequence: stable under concurrent
  // inserts/cancels, no OFFSET scans. Fetch one extra row to know if there's more.
  const { rows } = await getPool().query<BookingRow & { seq: string }>(
    `SELECT ${BOOKING_COLUMNS}, seq FROM bookings
      WHERE email = $1 AND seq > $2
      ORDER BY seq
      LIMIT $3`,
    [email, afterSeq, limit.value + 1],
  );

  const page = rows.slice(0, limit.value);
  const hasMore = rows.length > limit.value;
  return {
    status: 200,
    body: {
      bookings: page.map(toBooking),
      next_cursor: hasMore ? encodeCursor(page[page.length - 1].seq) : null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Levels 1–5: create a booking                                       */
/* ------------------------------------------------------------------ */

export type ParsedBody = { ok: true; raw: string; value: unknown } | { ok: false; raw: string };

/**
 * Entry point for POST /bookings. Pipeline:
 *   idempotency (L4) → rate limit (L5) → validation (L2) → slot checks (L2) → atomic insert (L3)
 *
 * Idempotent replays are answered from the ledger before the rate limiter, so a
 * client safely retrying a request it already made isn't penalised for it.
 */
export async function createBooking(input: {
  body: ParsedBody;
  idempotencyKey: string | null;
}): Promise<ApiResult<Booking>> {
  const key = input.idempotencyKey?.trim() || null;
  if (!key) return attemptBooking(input.body);

  const claim = await claimIdempotencyKey(key, requestHash(input.body));
  switch (claim.kind) {
    case "replay":
      return claim.result as ApiResult<Booking>;
    case "mismatch":
      return err(422, "Idempotency-Key was already used with a different request body");
    case "in_progress":
      return err(409, "a request with this Idempotency-Key is still being processed; retry shortly");
  }

  let result: ApiResult<Booking>;
  try {
    result = await attemptBooking(input.body);
  } catch (e) {
    await releaseIdempotencyKey(key);
    throw e;
  }

  // Store only final answers. A 429 or 5xx is transient: release the key so the
  // client can retry with it later and actually get a booking.
  if (result.status === 429 || result.status >= 500) await releaseIdempotencyKey(key);
  else await completeIdempotencyKey(key, result);
  return result;
}

async function attemptBooking(body: ParsedBody): Promise<ApiResult<Booking>> {
  if (!body.ok) return err(400, "request body must be valid JSON");

  // Level 5: count every attempt for this email — including ones that fail
  // validation below — before doing any other work.
  const rawEmail = (body.value as { email?: unknown } | null)?.email;
  if (typeof rawEmail === "string" && rawEmail.trim() !== "") {
    const rl = await consumeRateLimit(normalizeEmail(rawEmail));
    if (!rl.allowed) {
      return err(429, "too many booking attempts for this email; try again later", {
        "Retry-After": String(rl.retryAfter),
      });
    }
  }

  const v = validateNewBooking(body.value);
  if (!v.ok) return err(400, v.error);
  const { slot_id, name, email } = v.value;

  const slot = await getPool().query<{ started: boolean }>(
    "SELECT start_at <= now() AS started FROM slots WHERE id = $1",
    [slot_id],
  );
  if (slot.rowCount === 0) return err(404, "slot not found");
  if (slot.rows[0].started) return err(400, "slot has already started");

  try {
    const { rows } = await getPool().query<BookingRow>(
      `INSERT INTO bookings (id, slot_id, name, email, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING ${BOOKING_COLUMNS}`,
      [randomUUID(), slot_id, name, email],
    );
    return { status: 201, body: toBooking(rows[0]) };
  } catch (e) {
    const code = pgErrorCode(e);
    if (code === "23505") return err(409, "slot is already booked"); // partial unique index
    if (code === "23503") return err(404, "slot not found"); // slot removed by a concurrent reset
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Level 5: sliding-window rate limit, shared across all instances    */
/* ------------------------------------------------------------------ */

async function consumeRateLimit(email: string): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  return withTransaction(async (c) => {
    // Serialise attempts for the same email (other emails don't contend), so
    // the count-then-insert below can't be raced past the limit.
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`booking-rate:${email}`]);
    await c.query(
      "DELETE FROM booking_attempts WHERE email = $1 AND attempted_at <= clock_timestamp() - make_interval(secs => $2)",
      [email, RATE_LIMIT_WINDOW_SECONDS],
    );
    const { rows } = await c.query<{ n: number; oldest_age: number | null }>(
      `SELECT count(*)::int AS n,
              extract(epoch FROM clock_timestamp() - min(attempted_at))::float8 AS oldest_age
         FROM booking_attempts WHERE email = $1`,
      [email],
    );
    const { n, oldest_age } = rows[0];
    if (n >= RATE_LIMIT_MAX_ATTEMPTS) {
      // Seconds until the oldest attempt leaves the window and frees a slot.
      const retryAfter = Math.max(1, Math.ceil(RATE_LIMIT_WINDOW_SECONDS - (oldest_age ?? 0)));
      return { allowed: false, retryAfter };
    }
    await c.query("INSERT INTO booking_attempts (email) VALUES ($1)", [email]);
    return { allowed: true };
  });
}

/* ------------------------------------------------------------------ */
/* Level 4: idempotency ledger                                        */
/* ------------------------------------------------------------------ */

/** Hash of the request body, insensitive to key order and whitespace. */
function requestHash(body: ParsedBody): string {
  const canonical = body.ok ? canonicalJson(body.value) : `raw:${body.raw}`;
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(v);
}

type Claim =
  | { kind: "claimed" }
  | { kind: "replay"; result: ApiResult<unknown> }
  | { kind: "mismatch" }
  | { kind: "in_progress" };

const WAIT_FOR_IN_FLIGHT_MS = 10_000;
const STALE_CLAIM_SECONDS = 60;

/**
 * Atomically claims the key (INSERT … ON CONFLICT DO NOTHING). If another
 * request already holds it, waits for that request to finish and replays its
 * response — so two identical requests racing each other still produce one
 * booking and the same answer.
 */
async function claimIdempotencyKey(key: string, hash: string): Promise<Claim> {
  const pool = getPool();
  const deadline = Date.now() + WAIT_FOR_IN_FLIGHT_MS;

  for (;;) {
    const inserted = await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING RETURNING key`,
      [key, hash],
    );
    if (inserted.rowCount === 1) return { kind: "claimed" };

    const { rows } = await pool.query<{
      request_hash: string;
      status_code: number | null;
      response_body: unknown;
      stale: boolean;
    }>(
      `SELECT request_hash, status_code, response_body,
              created_at < now() - make_interval(secs => $2) AS stale
         FROM idempotency_keys WHERE key = $1`,
      [key, STALE_CLAIM_SECONDS],
    );
    const row = rows[0];
    if (!row) continue; // released between our INSERT and SELECT; try to claim again

    if (row.request_hash !== hash) return { kind: "mismatch" };
    if (row.status_code !== null) {
      return { kind: "replay", result: { status: row.status_code, body: row.response_body as never } };
    }
    if (row.stale) {
      // The original request died mid-flight (e.g. function timeout). Free it.
      await pool.query(
        "DELETE FROM idempotency_keys WHERE key = $1 AND status_code IS NULL AND created_at < now() - make_interval(secs => $2)",
        [key, STALE_CLAIM_SECONDS],
      );
      continue;
    }
    if (Date.now() > deadline) return { kind: "in_progress" };
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function completeIdempotencyKey(key: string, result: ApiResult<unknown>) {
  await getPool().query(
    `UPDATE idempotency_keys SET status_code = $2, response_body = $3, completed_at = now() WHERE key = $1`,
    [key, result.status, JSON.stringify(result.body)],
  );
}

async function releaseIdempotencyKey(key: string) {
  await getPool()
    .query("DELETE FROM idempotency_keys WHERE key = $1 AND status_code IS NULL", [key])
    .catch((e) => console.error("failed to release idempotency key", e));
}
