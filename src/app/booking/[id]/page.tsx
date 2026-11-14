import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarPlus, Check } from "lucide-react";
import { getBooking, getSlotsByIds } from "@/lib/service";
import { Avatar } from "@/app/avatar";
import { DayText, TimeRange } from "@/app/when";
import { CancelButton } from "./cancel-button";

export default function BookingPage({ params }: PageProps<"/booking/[id]">) {
  return (
    <Suspense fallback={<div className="card h-80 animate-pulse" />}>
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
      {confirmed ? (
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-accent">
          <Check size={16} strokeWidth={2.5} aria-hidden /> Confirmed
        </p>
      ) : (
        <p className="mb-2 text-sm font-medium text-muted">Cancelled</p>
      )}
      <h1>{confirmed ? "You’re booked" : "This appointment was cancelled"}</h1>

      <div className={`card mt-6 ${confirmed ? "" : "text-muted"}`}>
        {slot && (
          <div className="flex items-center gap-3.5 border-b border-border p-4">
            <Avatar name={slot.provider} />
            <p className="font-medium">{slot.provider}</p>
          </div>
        )}
        <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 p-4">
          {slot && (
            <>
              <dt className="text-muted">Date</dt>
              <dd>
                <DayText iso={slot.start} />
              </dd>
              <dt className="text-muted">Time</dt>
              <dd>
                <TimeRange start={slot.start} end={slot.end} />
              </dd>
            </>
          )}
          <dt className="text-muted">Patient</dt>
          <dd>{booking.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="break-all">{booking.email}</dd>
        </dl>
      </div>

      {confirmed && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a href={`/booking/${booking.id}/calendar`} className="btn btn-secondary sm:flex-1">
            <CalendarPlus size={17} aria-hidden /> Add to calendar
          </a>
          <CancelButton id={booking.id} />
        </div>
      )}
    </>
  );
}
