import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight } from "lucide-react";
import { getSlotsByIds, listBookings } from "@/lib/service";
import { DateTile, TimeRange } from "@/app/when";

export default function MyBookingsPage({ searchParams }: PageProps<"/my-bookings">) {
  return (
    <>
      <h1>My bookings</h1>
      <Suspense>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/my-bookings">["searchParams"] }) {
  const { email, cursor } = await searchParams;

  return (
    <>
      <form className="mt-6 flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="Email you booked with"
          aria-label="Email"
          defaultValue={email}
          className="field"
        />
        <button className="btn btn-primary">Find</button>
      </form>
      {typeof email === "string" && email && (
        <Suspense fallback={<div className="card mt-6 h-40 animate-pulse" />}>
          <BookingList email={email} cursor={typeof cursor === "string" ? cursor : null} />
        </Suspense>
      )}
    </>
  );
}

async function BookingList({ email, cursor }: { email: string; cursor: string | null }) {
  await connection();
  const result = await listBookings({ email, limit: "10", cursor });
  if (!("bookings" in result.body)) return <p className="mt-6 text-danger">{result.body.error}</p>;

  const { bookings, next_cursor } = result.body;
  if (bookings.length === 0) {
    return <p className="card mt-6 px-5 py-10 text-center text-muted">No bookings for {email}.</p>;
  }
  const slots = await getSlotsByIds(bookings.map((b) => b.slot_id));

  return (
    <>
      <ul className="card mt-6 divide-y divide-border">
        {bookings.map((b) => {
          const slot = slots.get(b.slot_id);
          const cancelled = b.status === "cancelled";
          return (
            <li key={b.id}>
              <Link href={`/booking/${b.id}`} className="flex items-center gap-3.5 px-4 py-3 hover:bg-background">
                {slot && <DateTile iso={slot.start} muted={cancelled} />}
                <span className={`min-w-0 flex-1 ${cancelled ? "text-muted" : ""}`}>
                  <span className="block font-medium">{slot?.provider}</span>
                  <span className="block text-sm text-muted">
                    {slot && <TimeRange start={slot.start} end={slot.end} />}
                    {cancelled && " · Cancelled"}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {next_cursor && (
        <Link
          href={`/my-bookings?email=${encodeURIComponent(email)}&cursor=${encodeURIComponent(next_cursor)}`}
          className="btn btn-secondary mt-4 w-full"
        >
          Show more
        </Link>
      )}
    </>
  );
}
