import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getBooking, getSlotsByIds } from "@/lib/service";
import { cancelBookingAction } from "@/app/actions";
import { When } from "@/app/when";

export default function BookingPage({ params }: PageProps<"/booking/[id]">) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-border/50" />}>
      <Booking params={params} />
    </Suspense>
  );
}

async function Booking({ params }: { params: PageProps<"/booking/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const result = await getBooking(id);
  if (!("id" in result.body)) notFound();
  const booking = result.body;
  const slot = (await getSlotsByIds([booking.slot_id])).get(booking.slot_id);
  const confirmed = booking.status === "confirmed";

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{confirmed ? "Booked" : "Cancelled"}</h1>

      <div className={`mt-6 rounded-xl border border-border bg-surface p-5 ${confirmed ? "" : "text-muted"}`}>
        {slot && (
          <>
            <p className="font-medium">{slot.provider}</p>
            <p className="text-muted">
              <When start={slot.start} end={slot.end} />
            </p>
          </>
        )}
        <p className="mt-4">{booking.name}</p>
        <p className="text-muted">{booking.email}</p>
      </div>

      {confirmed && (
        <form action={cancelBookingAction} className="mt-4">
          <input type="hidden" name="id" value={booking.id} />
          <button className="btn border border-border text-danger">Cancel booking</button>
        </form>
      )}
    </>
  );
}
