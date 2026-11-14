import { getBooking, getSlotsByIds } from "@/lib/service";

// GET /booking/{id}/calendar — an .ics file for the patient's calendar app.
// Same access as the confirmation page: whoever holds the unguessable booking id.
export async function GET(_request: Request, ctx: RouteContext<"/booking/[id]/calendar">) {
  const { id } = await ctx.params;
  const result = await getBooking(id);
  if (!("id" in result.body) || result.body.status !== "confirmed") {
    return new Response("Not found", { status: 404 });
  }
  const booking = result.body;
  const slot = (await getSlotsByIds([booking.slot_id])).get(booking.slot_id);
  if (!slot) return new Response("Not found", { status: 404 });

  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clinic//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}`,
    `DTSTAMP:${stamp(booking.created_at)}`,
    `DTSTART:${stamp(slot.start)}`,
    `DTEND:${stamp(slot.end)}`,
    `SUMMARY:Appointment with ${slot.provider.replace(/[,;\\]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointment.ics"`,
    },
  });
}
