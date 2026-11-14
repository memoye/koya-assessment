import { toResponse, withApi } from "@/lib/http";
import { cancelBooking, getBooking } from "@/lib/service";

type Ctx = RouteContext<"/bookings/[id]">;

// GET /bookings/{id} — Level 1.
export const GET = withApi<Ctx>(async (_request, ctx) => {
  const { id } = await ctx.params;
  return toResponse(await getBooking(id));
});

// DELETE /bookings/{id} — Level 3. Cancel and free the slot.
export const DELETE = withApi<Ctx>(async (_request, ctx) => {
  const { id } = await ctx.params;
  return toResponse(await cancelBooking(id));
});
