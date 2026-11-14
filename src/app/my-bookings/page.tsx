import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarX2, ChevronRight } from "lucide-react";
import { getSlotsByIds, listBookings } from "@/lib/service";
import { DateTile, When } from "@/app/when";

export default function MyBookingsPage({ searchParams }: PageProps<"/my-bookings">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
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
          placeholder="Your email"
          aria-label="Email"
          defaultValue={email}
          className="field bg-surface"
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
    return (
      <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-12 text-center">
        <CalendarX2 className="text-muted" size={28} aria-hidden />
        <p className="font-medium">No bookings found</p>
      </div>
    );
  }
  const slots = await getSlotsByIds(bookings.map((b) => b.slot_id));

  return (
    <>
      <ul className="card mt-6 divide-y divide-border overflow-hidden">
        {bookings.map((b) => {
          const slot = slots.get(b.slot_id);
          const cancelled = b.status === "cancelled";
          return (
            <li key={b.id}>
              <Link href={`/booking/${b.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-background">
                {slot && <DateTile iso={slot.start} muted={cancelled} />}
                <span className={`min-w-0 flex-1 ${cancelled ? "text-muted" : ""}`}>
                  <span className="block font-medium">{slot?.provider}</span>
                  <span className="block truncate text-sm text-muted">
                    {slot && <When start={slot.start} end={slot.end} />}
                  </span>
                </span>
                {cancelled && (
                  <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted">Cancelled</span>
                )}
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
