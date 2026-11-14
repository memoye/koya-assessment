import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getSlot } from "@/lib/service";
import { Avatar } from "@/app/avatar";
import { When } from "@/app/when";
import { BookingForm } from "./booking-form";
import { BackToTimes } from "./back-to-times";

export default function BookPage({ params }: PageProps<"/book/[slot]">) {
  return (
    <Suspense fallback={<div className="card h-72 animate-pulse" />}>
      <Book params={params} />
    </Suspense>
  );
}

async function load(id: string) {
  await connection();
  // One key per page view: a double-submit or network retry can't double-book.
  return { slot: await getSlot(id), idempotencyKey: randomUUID() };
}

async function Book({ params }: { params: PageProps<"/book/[slot]">["params"] }) {
  const { slot: id } = await params;
  const { slot, idempotencyKey } = await load(id);
  if (!slot) notFound();

  if (!slot.bookable) {
    return (
      <>
        <BackToTimes slot={slot} />
        <h1>This time is no longer available</h1>
        <Link href="/" className="btn btn-primary mt-6">
          Find another time
        </Link>
      </>
    );
  }

  return (
    <>
      <BackToTimes slot={slot} />
      <h1>Your details</h1>
      <div className="card mt-6 flex items-center gap-3.5 p-4">
        <Avatar name={slot.provider} />
        <div className="min-w-0">
          <p className="font-medium">{slot.provider}</p>
          <p className="text-sm text-muted">
            <When start={slot.start} end={slot.end} />
          </p>
        </div>
      </div>
      <BookingForm slotId={slot.id} idempotencyKey={idempotencyKey} />
    </>
  );
}
