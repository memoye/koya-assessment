import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight } from "lucide-react";
import { listBookableSlots } from "@/lib/service";
import { slugify } from "@/lib/slug";
import { Avatar } from "./avatar";
import { ShortDateTime } from "./when";

export default function Home() {
  return (
    <>
      <h1>Book an appointment</h1>
      <Suspense fallback={<div className="card mt-6 h-72 animate-pulse" />}>
        <Doctors />
      </Suspense>
    </>
  );
}

async function Doctors() {
  await connection();
  const slots = await listBookableSlots();
  if (slots.length === 0) {
    return <p className="card mt-6 px-5 py-10 text-center text-muted">No appointments are available right now.</p>;
  }

  // Slots arrive earliest-first: the first overall is the soonest, the first per doctor is their next opening.
  const soonest = slots[0];
  const nextByDoctor = new Map<string, (typeof slots)[number]>();
  for (const s of slots) if (!nextByDoctor.has(s.provider)) nextByDoctor.set(s.provider, s);
  const doctors = [...nextByDoctor.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <div className="card mt-6 flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="label">Soonest appointment</p>
          <p className="mt-0.5 font-medium">
            <ShortDateTime iso={soonest.start} />
          </p>
          <p className="text-sm text-muted">{soonest.provider}</p>
        </div>
        <Link href={`/book/${encodeURIComponent(soonest.id)}`} className="btn btn-primary">
          Book
        </Link>
      </div>

      <h2 className="label mt-8 mb-2">Or choose a doctor</h2>
      <ul className="card divide-y divide-border">
        {doctors.map(([name, next]) => (
          <li key={name}>
            <Link href={`/doctors/${slugify(name)}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-background">
              <Avatar name={name} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{name}</span>
                <span className="block text-sm text-muted">
                  Next available <ShortDateTime iso={next.start} />
                </span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
