import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getBooking, getSlotsByIds } from "@/lib/service";
import { cancelBookingAction } from "@/app/actions";
import { LocalDateTime, SlotWhen } from "@/app/when";
import { StatusBadge } from "@/app/status-badge";

export default function BookingPage({ params }: PageProps<"/booking/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-xl animate-pulse rounded-2xl bg-border/60" />}>
      <BookingDetails params={params} />
    </Suspense>
  );
}

async function BookingDetails({ params }: { params: PageProps<"/booking/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const result = await getBooking(id);
  if (!("id" in result.body)) notFound();
  const booking = result.body;
  const slot = (await getSlotsByIds([booking.slot_id])).get(booking.slot_id);
  const confirmed = booking.status === "confirmed";

  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className={`px-6 py-8 text-center ${confirmed ? "bg-accent-soft" : "bg-background"}`}>
          <div
            aria-hidden
            className={`mx-auto grid size-12 place-items-center rounded-full text-xl ${
              confirmed ? "bg-accent text-accent-foreground" : "bg-border text-muted"
            }`}
          >
            {confirmed ? "✓" : "✕"}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {confirmed ? "You’re booked" : "Booking cancelled"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {confirmed
              ? `A confirmation is held for ${booking.email}.`
              : "This appointment has been cancelled and the slot released."}
          </p>
        </div>

        <dl className="divide-y divide-border px-6 text-sm">
          {slot && (
            <>
              <Row label="Provider">{slot.provider}</Row>
              <Row label="When">
                <SlotWhen start={slot.start} end={slot.end} />
              </Row>
            </>
          )}
          <Row label="Name">{booking.name}</Row>
          <Row label="Email">{booking.email}</Row>
          <Row label="Status">
            <StatusBadge status={booking.status} />
          </Row>
          <Row label="Reference">
            <span className="font-mono text-xs">{booking.id}</span>
          </Row>
          <Row label="Booked at">
            <LocalDateTime iso={booking.created_at} />
          </Row>
        </dl>

        <div className="flex flex-col gap-2 border-t border-border p-6 sm:flex-row [&>*]:flex-1">
          <Link
            href="/"
            className="rounded-lg bg-accent px-4 py-2.5 text-center whitespace-nowrap font-medium text-accent-foreground hover:opacity-90"
          >
            Book another
          </Link>
          <Link
            href={`/my-bookings?email=${encodeURIComponent(booking.email)}`}
            className="rounded-lg border border-border px-4 py-2.5 text-center whitespace-nowrap font-medium hover:bg-background"
          >
            My bookings
          </Link>
          {confirmed && (
            <form action={cancelBookingAction}>
              <input type="hidden" name="id" value={booking.id} />
              <button
                type="submit"
                className="w-full whitespace-nowrap rounded-lg border border-border px-4 py-2.5 font-medium text-danger hover:bg-danger-soft"
              >
                Cancel booking
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
