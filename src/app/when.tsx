"use client";

import { formatDateTime, formatDay, formatTime, useTimeZone } from "@/lib/time";

/** Slot date/time in the viewer's time zone (UTC during SSR/hydration). */
export function SlotWhen({ start, end }: { start: string; end: string }) {
  const tz = useTimeZone();
  return (
    <span>
      {formatDay(start, tz)}, {formatTime(start, tz)} – {formatTime(end, tz)}
    </span>
  );
}

export function LocalDateTime({ iso }: { iso: string }) {
  const tz = useTimeZone();
  return <span>{formatDateTime(iso, tz)}</span>;
}
