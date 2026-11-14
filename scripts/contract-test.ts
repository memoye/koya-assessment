/**
 * End-to-end contract tests for the booking API, run against a live server.
 *
 *   BASE_URL=http://localhost:3000 API_KEY=... npm run test:contract
 *
 * WARNING: calls POST /reset, which wipes all bookings on the target.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API_KEY = process.env.API_KEY ?? "";
if (!API_KEY) throw new Error("API_KEY is required");

type Res = { status: number; body: any; headers: Headers };

async function call(
  method: string,
  path: string,
  opts: { body?: unknown; rawBody?: string; key?: string | null; headers?: Record<string, string> } = {},
): Promise<Res> {
  const headers: Record<string, string> = { ...opts.headers };
  const key = opts.key === undefined ? API_KEY : opts.key;
  if (key !== null) headers["X-API-Key"] = key;
  let body: string | undefined;
  if (opts.rawBody !== undefined) body = opts.rawBody;
  else if (opts.body !== undefined) body = JSON.stringify(opts.body);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {}
  return { status: res.status, body: parsed, headers: res.headers };
}

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString().replace(/\.\d{3}Z$/, "Z");
const DAY = 86_400_000;
const uniqEmail = (tag: string) => `${tag}-${randomUUID().slice(0, 8)}@example.com`;

function seedSlots() {
  const slots = [
    // Deliberately out of order to test sorting.
    { id: "s2", provider: "Dr Ade", start: iso(2 * DAY), end: iso(2 * DAY + 1_800_000) },
    { id: "s1", provider: "Dr Ade", start: iso(1 * DAY), end: iso(1 * DAY + 1_800_000) },
    { id: "s3", provider: "Dr Bello", start: iso(1.5 * DAY), end: iso(1.5 * DAY + 1_800_000) },
    { id: "past", provider: "Dr Ade", start: iso(-DAY), end: iso(-DAY + 1_800_000) },
  ];
  for (let i = 0; i < 40; i++) {
    slots.push({ id: `x${i}`, provider: "Dr Chi", start: iso(3 * DAY + i * 3_600_000), end: iso(3 * DAY + i * 3_600_000 + 1_800_000) });
  }
  return slots;
}

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m\n    ${(e as Error).message.split("\n").join("\n    ")}`);
  }
}

const book = (slot_id: string, email: string, extra: { name?: string; headers?: Record<string, string> } = {}) =>
  call("POST", "/bookings", { body: { slot_id, name: extra.name ?? "Ada Obi", email }, headers: extra.headers });

async function main() {
  console.log(`Contract tests against ${BASE_URL}\n`);
  const slots = seedSlots();

  console.log("Level 1 · list, book, look up");
  await test("POST /reset → 200", async () => {
    const r = await call("POST", "/reset", { body: { slots } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });
  await test("GET /slots → earliest first, echoes start/end verbatim, all available", async () => {
    const r = await call("GET", "/slots");
    assert.equal(r.status, 200);
    assert.equal(r.body.slots.length, slots.length);
    assert.deepEqual(r.body.slots.slice(0, 4).map((s: any) => s.id), ["past", "s1", "s3", "s2"]);
    const s1 = r.body.slots.find((s: any) => s.id === "s1");
    const seeded = slots.find((s) => s.id === "s1")!;
    assert.deepEqual(s1, { ...seeded, available: true });
  });
  await test("GET /slots?provider= → exact match only", async () => {
    const r = await call("GET", "/slots?provider=Dr%20Bello");
    assert.deepEqual(r.body.slots.map((s: any) => s.id), ["s3"]);
    const none = await call("GET", "/slots?provider=dr%20bello");
    assert.equal(none.body.slots.length, 0);
  });
  let bookingId = "";
  await test("POST /bookings → 201 confirmed booking", async () => {
    const r = await book("s1", uniqEmail("l1"));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.status, "confirmed");
    assert.equal(r.body.slot_id, "s1");
    assert.ok(r.body.id && r.body.created_at);
    assert.ok(!Number.isNaN(Date.parse(r.body.created_at)));
    bookingId = r.body.id;
  });
  await test("GET /bookings/{id} → 200, slot shows unavailable", async () => {
    const r = await call("GET", `/bookings/${bookingId}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.id, bookingId);
    const s = await call("GET", "/slots");
    assert.equal(s.body.slots.find((x: any) => x.id === "s1").available, false);
  });
  await test("GET /bookings/{unknown} → 404 with error body", async () => {
    const r = await call("GET", "/bookings/does-not-exist");
    assert.equal(r.status, 404);
    assert.equal(typeof r.body.error, "string");
  });

  console.log("\nLevel 2 · API key and validation");
  for (const [label, key] of [["missing", null], ["wrong", "nope"]] as const) {
    for (const [method, path] of [["GET", "/slots"], ["POST", "/bookings"], ["GET", `/bookings/${bookingId}`], ["DELETE", `/bookings/${bookingId}`], ["POST", "/reset"], ["GET", "/bookings?email=a@b.co"]]) {
      await test(`${label} key: ${method} ${path} → 401`, async () => {
        const r = await call(method, path, { key, body: method === "POST" ? {} : undefined });
        assert.equal(r.status, 401);
        assert.equal(typeof r.body.error, "string");
      });
    }
  }
  const bad: [string, unknown][] = [
    ["missing slot_id", { name: "A", email: "a@example.com" }],
    ["missing name", { slot_id: "s2", email: uniqEmail("v") }],
    ["missing email", { slot_id: "s2", name: "A" }],
    ["empty name (spaces)", { slot_id: "s2", name: "   ", email: uniqEmail("v") }],
    ["empty slot_id", { slot_id: "", name: "A", email: uniqEmail("v") }],
    ["invalid email", { slot_id: "s2", name: "A", email: "not-an-email" }],
    ["invalid email (no tld)", { slot_id: "s2", name: "A", email: "a@b" }],
    ["non-string name", { slot_id: "s2", name: 42, email: uniqEmail("v") }],
  ];
  for (const [label, body] of bad) {
    await test(`${label} → 400`, async () => {
      const r = await call("POST", "/bookings", { body });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.equal(typeof r.body.error, "string");
    });
  }
  await test("malformed JSON → 400", async () => {
    const r = await call("POST", "/bookings", { rawBody: "{nope" });
    assert.equal(r.status, 400);
  });
  await test("unknown slot → 404", async () => {
    const r = await book("nope", uniqEmail("v"));
    assert.equal(r.status, 404);
  });
  await test("slot already started → 400", async () => {
    const r = await book("past", uniqEmail("v"));
    assert.equal(r.status, 400);
  });
  await test("trims name/email and lower-cases email", async () => {
    const email = uniqEmail("Trim");
    const r = await call("POST", "/bookings", { body: { slot_id: "s3", name: "  Ada Obi  ", email: `  ${email.toUpperCase()}  ` } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.name, "Ada Obi");
    assert.equal(r.body.email, email.toLowerCase());
  });

  console.log("\nLevel 3 · no double booking, cancellation");
  await test("25 concurrent bookings for one slot → exactly one 201, rest 409", async () => {
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => book("s2", uniqEmail(`race${i}`))));
    const codes = results.map((r) => r.status);
    assert.equal(codes.filter((c) => c === 201).length, 1, `codes: ${codes.join(",")}`);
    assert.equal(codes.filter((c) => c === 409).length, 24, `codes: ${codes.join(",")}`);
  });
  await test("DELETE /bookings/{id} → 200 cancelled, slot freed, rebookable", async () => {
    const r = await call("DELETE", `/bookings/${bookingId}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, "cancelled");
    assert.equal(r.body.id, bookingId);
    const s = await call("GET", "/slots");
    assert.equal(s.body.slots.find((x: any) => x.id === "s1").available, true);
    const again = await book("s1", uniqEmail("rebook"));
    assert.equal(again.status, 201);
    const old = await call("GET", `/bookings/${bookingId}`);
    assert.equal(old.body.status, "cancelled");
  });
  await test("cancel twice → 409; cancel unknown → 404", async () => {
    assert.equal((await call("DELETE", `/bookings/${bookingId}`)).status, 409);
    assert.equal((await call("DELETE", "/bookings/nope")).status, 404);
  });
  await test("concurrent cancels of one booking → one 200, rest 409", async () => {
    const b = await book("x0", uniqEmail("cc"));
    const rs = await Promise.all(Array.from({ length: 10 }, () => call("DELETE", `/bookings/${b.body.id}`)));
    const codes = rs.map((r) => r.status);
    assert.equal(codes.filter((c) => c === 200).length, 1, codes.join(","));
  });

  console.log("\nLevel 4 · idempotency and pagination");
  await test("same Idempotency-Key + same body → same status and booking id, one booking", async () => {
    const email = uniqEmail("idem");
    const headers = { "Idempotency-Key": randomUUID() };
    const a = await book("x1", email, { headers });
    const b = await call("POST", "/bookings", { rawBody: JSON.stringify({ email, name: "Ada Obi", slot_id: "x1" }), headers });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(a.body.id, b.body.id);
    const list = await call("GET", `/bookings?email=${encodeURIComponent(email)}`);
    assert.equal(list.body.bookings.length, 1);
  });
  await test("concurrent retries with the same key → one booking, identical responses", async () => {
    const email = uniqEmail("idemrace");
    const headers = { "Idempotency-Key": randomUUID() };
    const rs = await Promise.all(Array.from({ length: 4 }, () => book("x2", email, { headers })));
    assert.deepEqual(rs.map((r) => r.status), [201, 201, 201, 201]);
    assert.equal(new Set(rs.map((r) => r.body.id)).size, 1);
  });
  await test("same key + different body → 422", async () => {
    const headers = { "Idempotency-Key": randomUUID() };
    const email = uniqEmail("idem422");
    assert.equal((await book("x3", email, { headers })).status, 201);
    const r = await book("x4", email, { headers });
    assert.equal(r.status, 422);
    assert.equal(typeof r.body.error, "string");
  });
  await test("error responses are replayed too (same key → same 409)", async () => {
    const headers = { "Idempotency-Key": randomUUID() };
    const email = uniqEmail("idem409");
    const a = await book("s2", email, { headers });
    const b = await book("s2", email, { headers });
    assert.equal(a.status, 409);
    assert.equal(b.status, 409);
  });
  const pager = uniqEmail("Pager");
  await test("pagination: 5 bookings, limit=2 → pages of 2,2,1 oldest first, last next_cursor null", async () => {
    const ids: string[] = [];
    // 5 is the most one email can make per minute (level 5). Mixed casing checks the email match ignores case.
    for (let i = 10; i < 15; i++) {
      const r = await book(`x${i}`, i % 2 ? pager.toUpperCase() : pager);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      ids.push(r.body.id);
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    const pageSizes: number[] = [];
    do {
      const qs: string = `email=${encodeURIComponent(pager.toUpperCase())}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const r = await call("GET", `/bookings?${qs}`);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      pageSizes.push(r.body.bookings.length);
      seen.push(...r.body.bookings.map((b: any) => b.id));
      assert.ok("next_cursor" in r.body);
      cursor = r.body.next_cursor;
    } while (cursor);
    assert.deepEqual(pageSizes, [2, 2, 1]);
    assert.deepEqual(seen, ids);
  });
  await test("default limit is 10", async () => {
    const r = await call("GET", `/bookings?email=${encodeURIComponent(pager)}`);
    assert.equal(r.body.bookings.length, 5);
    assert.equal(r.body.next_cursor, null);
  });
  for (const limit of ["0", "51", "abc", "-1", "2.5", ""]) {
    await test(`limit=${JSON.stringify(limit)} → 400`, async () => {
      const r = await call("GET", `/bookings?email=${encodeURIComponent(pager)}&limit=${limit}`);
      assert.equal(r.status, 400);
    });
  }
  await test("limit=1 and limit=50 are accepted", async () => {
    assert.equal((await call("GET", `/bookings?email=${encodeURIComponent(pager)}&limit=1`)).status, 200);
    assert.equal((await call("GET", `/bookings?email=${encodeURIComponent(pager)}&limit=50`)).status, 200);
  });
  await test("missing email → 400; garbage cursor → 400; unknown email → empty page", async () => {
    assert.equal((await call("GET", "/bookings")).status, 400);
    assert.equal((await call("GET", `/bookings?email=${encodeURIComponent(pager)}&cursor=garbage`)).status, 400);
    const r = await call("GET", `/bookings?email=${encodeURIComponent(uniqEmail("nobody"))}`);
    assert.deepEqual(r.body, { bookings: [], next_cursor: null });
  });

  console.log("\nLevel 5 · rate limiting");
  await test("6th attempt in a minute for one email → 429 + integer Retry-After; failures count", async () => {
    const email = uniqEmail("spam");
    const codes: number[] = [];
    // Mix of successes and failures — all five count.
    codes.push((await book("x20", email)).status); // 201
    codes.push((await book("x20", email)).status); // 409
    codes.push((await book("nope", email)).status); // 404
    codes.push((await book("past", email)).status); // 400
    codes.push((await call("POST", "/bookings", { body: { slot_id: "x21", email } })).status); // 400 (no name)
    const sixth = await book("x21", email);
    assert.deepEqual(codes, [201, 409, 404, 400, 400]);
    assert.equal(sixth.status, 429, JSON.stringify(sixth.body));
    assert.equal(typeof sixth.body.error, "string");
    const ra = sixth.headers.get("retry-after");
    assert.ok(ra && /^\d+$/.test(ra) && Number(ra) >= 1 && Number(ra) <= 60, `Retry-After: ${ra}`);
  });
  await test("email match for rate limit ignores case/whitespace", async () => {
    const email = uniqEmail("spamcase");
    for (let i = 0; i < 5; i++) await book("nope", i % 2 ? `  ${email.toUpperCase()} ` : email);
    assert.equal((await book("nope", email)).status, 429);
  });
  await test("other emails are not affected", async () => {
    const r = await book("x22", uniqEmail("innocent"));
    assert.equal(r.status, 201);
  });
  await test("concurrent burst of 12 for one email → at most 5 get through", async () => {
    const email = uniqEmail("burst");
    const rs = await Promise.all(Array.from({ length: 12 }, () => book("nope", email)));
    const codes = rs.map((r) => r.status);
    assert.equal(codes.filter((c) => c !== 429).length, 5, codes.join(","));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
