import { Suspense } from "react";
import { connection } from "next/server";
import { listSlots } from "@/lib/service";
import { SlotPicker } from "./slot-picker";

export default function Home() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Book an appointment</h1>
      <p className="mt-2 text-muted">Choose an available time, add your details, and you&apos;re booked.</p>
      <div className="mt-8">
        <Suspense fallback={<SlotsSkeleton />}>
          <Slots />
        </Suspense>
      </div>
    </>
  );
}

async function loadSlots() {
  await connection();
  const slots = await listSlots(null);
  // Request time, so "past" is decided the same way on server and client.
  return { slots, now: Date.now() };
}

async function Slots() {
  const { slots, now } = await loadSlots();
  return <SlotPicker slots={slots} now={now} />;
}

function SlotsSkeleton() {
  return (
    <div className="grid animate-pulse gap-3 sm:grid-cols-3" aria-label="Loading slots">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-16 rounded-xl bg-border/60" />
      ))}
    </div>
  );
}
