import { readJson, toResponse, withApi } from "@/lib/http";
import { createBooking, listBookings } from "@/lib/service";

// POST /bookings — Levels 1–5. Book a slot.
export const POST = withApi(async (request) => {
  const body = await readJson(request);
  const idempotencyKey = request.headers.get("idempotency-key");
  return toResponse(await createBooking({ body, idempotencyKey }));
});

// GET /bookings?email=&limit=&cursor= — Level 4. A person's bookings, oldest first.
export const GET = withApi(async (request) => {
  const q = new URL(request.url).searchParams;
  return toResponse(
    await listBookings({ email: q.get("email"), limit: q.get("limit"), cursor: q.get("cursor") }),
  );
});
