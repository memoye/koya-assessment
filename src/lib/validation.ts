import type { Slot } from "./types";

// Deliberately pragmatic: one "@", no whitespace, a dot in the domain, no
// leading/trailing dot in the domain. Full RFC 5322 accepts far more than any
// clinic wants to email.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

export type NewBookingInput = { slot_id: string; name: string; email: string };

type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Level 2: trims name/email, lower-cases email, rejects missing/empty/invalid fields. */
export function validateNewBooking(body: unknown): Validated<NewBookingInput> {
  if (!isPlainObject(body)) return { ok: false, error: "request body must be a JSON object" };

  const out: Record<string, string> = {};
  for (const field of ["slot_id", "name", "email"] as const) {
    const v = body[field];
    if (v === undefined || v === null) return { ok: false, error: `${field} is required` };
    if (typeof v !== "string") return { ok: false, error: `${field} must be a string` };
    const trimmed = v.trim();
    if (trimmed === "") return { ok: false, error: `${field} must not be empty` };
    out[field] = trimmed;
  }

  if (out.name.length > 200) return { ok: false, error: "name is too long" };

  const email = out.email.toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "email is not valid" };

  return { ok: true, value: { slot_id: out.slot_id, name: out.name, email } };
}

/** /reset payload. Lenient on purpose: past slots are allowed, only shape is enforced. */
export function validateResetBody(body: unknown): Validated<Slot[]> {
  if (!isPlainObject(body) || !Array.isArray(body.slots)) {
    return { ok: false, error: "slots must be an array" };
  }

  const seen = new Set<string>();
  const slots: Slot[] = [];
  for (const [i, s] of body.slots.entries()) {
    if (!isPlainObject(s)) return { ok: false, error: `slots[${i}] must be an object` };
    for (const field of ["id", "provider", "start", "end"] as const) {
      if (typeof s[field] !== "string" || (s[field] as string).trim() === "") {
        return { ok: false, error: `slots[${i}].${field} is required` };
      }
    }
    const slot = s as Slot;
    if (Number.isNaN(Date.parse(slot.start))) return { ok: false, error: `slots[${i}].start is not a valid date-time` };
    if (Number.isNaN(Date.parse(slot.end))) return { ok: false, error: `slots[${i}].end is not a valid date-time` };
    if (seen.has(slot.id)) return { ok: false, error: `duplicate slot id: ${slot.id}` };
    seen.add(slot.id);
    slots.push({ id: slot.id, provider: slot.provider, start: slot.start, end: slot.end });
  }
  return { ok: true, value: slots };
}

/** Level 4: `limit` must be an integer 1..50; absent means 10. */
export function parseLimit(raw: string | null): Validated<number> {
  if (raw === null) return { ok: true, value: 10 };
  if (!/^\d+$/.test(raw)) return { ok: false, error: "limit must be an integer between 1 and 50" };
  const n = Number(raw);
  if (n < 1 || n > 50) return { ok: false, error: "limit must be an integer between 1 and 50" };
  return { ok: true, value: n };
}
