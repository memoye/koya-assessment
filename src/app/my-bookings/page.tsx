import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getSlotsByIds, listBookings } from "@/lib/service";
import { StatusBadge } from "@/app/status-badge";
import { SlotWhen } from "@/app/when";

const PAGE_SIZE = "5";

export default function MyBookingsPage({ searchParams }: PageProps<"/my-bookings">) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">My bookings</h1>
      <p className="mt-2 text-muted">Enter the email you booked with to see your appointments.</p>
      <Suspense fallback={<div className="mt-8 h-40 animate-pulse rounded-2xl bg-border/60" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/my-bookings">["searchParams"] }) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : null;

  return (
    <>
      <form action="/my-bookings" className="mt-6 flex gap-2">
        <input
          name="email"
          type="email"
          required
          defaultValue={email}
          placeholder="you@example.com"
          aria-label="Email"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:opacity-90">
          Look up
        </button>
      </form>
      {email && <BookingList email={email} cursor={cursor} />}
    </>
  );
}

async function BookingList({ email, cursor }: { email: string; cursor: string | null }) {
  await connection();
  const result = await listBookings({ email, limit: PAGE_SIZE, cursor });
  if (!("bookings" in result.body)) {
    return <p className="mt-6 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{result.body.error}</p>;
  }
  const { bookings, next_cursor } = result.body;
  const slots = await getSlotsByIds([...new Set(bookings.map((b) => b.slot_id))]);

  if (bookings.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
        {cursor ? "No more bookings." : "No bookings found for that email."}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {bookings.map((b) => {
          const slot = slots.get(b.slot_id);
          return (
            <li key={b.id}>
              <Link href={`/booking/${b.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-background">
                <div className="min-w-0">
                  <p className="font-medium">{slot?.provider ?? b.slot_id}</p>
                  <p className="text-sm text-muted">{slot ? <SlotWhen start={slot.start} end={slot.end} /> : "Slot removed"}</p>
                </div>
                <StatusBadge status={b.status} />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-between text-sm">
        {cursor ? (
          <Link href={`/my-bookings?email=${encodeURIComponent(email)}`} className="text-muted hover:text-foreground">
            ← First page
          </Link>
        ) : (
          <span />
        )}
        {next_cursor && (
          <Link
            href={`/my-bookings?email=${encodeURIComponent(email)}&cursor=${encodeURIComponent(next_cursor)}`}
            className="font-medium text-accent hover:underline"
          >
            Next page →
          </Link>
        )}
      </div>
    </div>
  );
}
