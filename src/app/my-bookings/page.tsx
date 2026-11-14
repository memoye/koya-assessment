import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getSlotsByIds, listBookings } from "@/lib/service";
import { When } from "@/app/when";

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
        <input name="email" type="email" required placeholder="Email" aria-label="Email" defaultValue={email} className="field" />
        <button className="btn bg-foreground text-background">Look up</button>
      </form>
      {typeof email === "string" && email && (
        <Suspense fallback={<div className="mt-6 h-32 animate-pulse rounded-xl bg-border/50" />}>
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
  if (bookings.length === 0) return <p className="mt-6 text-muted">No bookings.</p>;
  const slots = await getSlotsByIds(bookings.map((b) => b.slot_id));

  return (
    <>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
        {bookings.map((b) => {
          const slot = slots.get(b.slot_id);
          return (
            <li key={b.id}>
              <Link
                href={`/booking/${b.id}`}
                className={`block px-5 py-3 hover:bg-background ${b.status === "cancelled" ? "text-muted line-through" : ""}`}
              >
                <span className="font-medium">{slot?.provider}</span>
                <span className="block text-sm text-muted">{slot && <When start={slot.start} end={slot.end} />}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {next_cursor && (
        <Link
          href={`/my-bookings?email=${encodeURIComponent(email)}&cursor=${encodeURIComponent(next_cursor)}`}
          className="mt-4 inline-block text-sm text-muted hover:text-foreground"
        >
          Next →
        </Link>
      )}
    </>
  );
}
