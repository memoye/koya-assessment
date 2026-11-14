import { Suspense } from "react";
import { connection } from "next/server";
import { listSlots } from "@/lib/service";
import { SlotPicker } from "./slot-picker";

export default function Home() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Book an appointment</h1>
      <Suspense fallback={<div className="card mt-8 h-72 animate-pulse" />}>
        <Slots />
      </Suspense>
    </>
  );
}

/** Only slots a patient can actually book: not taken, not started. */
async function bookableSlots() {
  await connection();
  const now = Date.now();
  return (await listSlots(null)).filter((s) => s.available && Date.parse(s.start) > now);
}

async function Slots() {
  return <SlotPicker slots={await bookableSlots()} />;
}
