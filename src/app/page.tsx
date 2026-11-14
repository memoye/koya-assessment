import { Suspense } from "react";
import { connection } from "next/server";
import { listSlots } from "@/lib/service";
import { BookingFlow } from "./booking-flow";

export default function Home() {
  return (
    <Suspense fallback={<div className="card h-72 animate-pulse" />}>
      <Booking />
    </Suspense>
  );
}

/** Only slots a patient can actually book: not taken, not started. */
async function bookableSlots() {
  await connection();
  const now = Date.now();
  return (await listSlots(null)).filter((s) => s.available && Date.parse(s.start) > now);
}

async function Booking() {
  return <BookingFlow slots={await bookableSlots()} />;
}
