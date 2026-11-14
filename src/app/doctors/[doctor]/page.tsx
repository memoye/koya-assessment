import { Suspense } from "react";
import { connection } from "next/server";
import { listBookableSlots } from "@/lib/service";
import { slugify } from "@/lib/slug";
import { Avatar } from "@/app/avatar";
import { BackLink } from "@/app/back-link";
import { TimePicker } from "./time-picker";

export default function DoctorPage(props: PageProps<"/doctors/[doctor]">) {
  return (
    <>
      <BackLink href="/">All doctors</BackLink>
      <Suspense fallback={<div className="card h-72 animate-pulse" />}>
        <Doctor {...props} />
      </Suspense>
    </>
  );
}

async function Doctor({ params, searchParams }: PageProps<"/doctors/[doctor]">) {
  const [{ doctor }, { date }] = await Promise.all([params, searchParams]);
  await connection();
  const slots = (await listBookableSlots()).filter((s) => slugify(s.provider) === doctor);

  // A doctor exists only through their slots, so "fully booked" and "unknown" look the same here.
  if (slots.length === 0) {
    return <p className="card px-5 py-10 text-center text-muted">No available times for this doctor.</p>;
  }

  return (
    <>
      <div className="flex items-center gap-3.5">
        <Avatar name={slots[0].provider} size={48} />
        <h1>{slots[0].provider}</h1>
      </div>
      <TimePicker slots={slots} date={typeof date === "string" ? date : undefined} />
    </>
  );
}
