import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarDays, Check, Stethoscope, UserRound, X } from "lucide-react";
import { getBooking, getSlotsByIds } from "@/lib/service";
import { When } from "@/app/when";
import { CancelButton } from "./cancel-button";

export default function BookingPage({ params }: PageProps<"/booking/[id]">) {
  return (
    <Suspense fallback={<div className="card mx-auto h-80 max-w-md animate-pulse" />}>
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
    <div className="mx-auto max-w-md">
      <div className="flex flex-col items-center text-center">
        <span
          className={`grid size-14 place-items-center rounded-full ${
            confirmed ? "bg-accent text-on-accent" : "bg-border text-muted"
          }`}
        >
          {confirmed ? <Check size={28} strokeWidth={2.5} aria-hidden /> : <X size={28} aria-hidden />}
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {confirmed ? "You’re booked" : "Appointment cancelled"}
        </h1>
      </div>

      <ul className={`card mt-8 divide-y divide-border text-[15px] ${confirmed ? "" : "text-muted"}`}>
        {slot && (
          <>
            <Detail icon={<Stethoscope size={18} />}>{slot.provider}</Detail>
            <Detail icon={<CalendarDays size={18} />}>
              <When start={slot.start} end={slot.end} />
            </Detail>
          </>
        )}
        <Detail icon={<UserRound size={18} />}>
          {booking.name} · {booking.email}
        </Detail>
      </ul>

      {confirmed && (
        <div className="mt-4">
          <CancelButton id={booking.id} />
        </div>
      )}
    </div>
  );
}

function Detail({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <span className="text-muted" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}
