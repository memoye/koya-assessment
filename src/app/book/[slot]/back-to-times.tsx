"use client";

import type { Slot } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { dayKey, useTimeZone } from "@/lib/time";
import { BackLink } from "@/app/back-link";

/** Back to the doctor's times, on the same day (a client component: the day depends on the viewer's time zone). */
export function BackToTimes({ slot }: { slot: Slot }) {
  const tz = useTimeZone();
  return <BackLink href={`/doctors/${slugify(slot.provider)}?date=${dayKey(slot.start, tz)}`}>{slot.provider}</BackLink>;
}
