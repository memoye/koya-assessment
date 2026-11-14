"use client";

import { formatDay, formatTime, useTimeZone } from "@/lib/time";

/** "Monday 16 November, 10:00–10:30" in the viewer's time zone. */
export function When({ start, end }: { start: string; end: string }) {
  const tz = useTimeZone();
  return (
    <>
      {formatDay(start, tz)}, {formatTime(start, tz)}–{formatTime(end, tz)}
    </>
  );
}
