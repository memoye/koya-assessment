"use client";

import { dateParts, formatDay, formatTime, useTimeZone } from "@/lib/time";

/** "Monday 16 November, 10:00–10:30" in the viewer's time zone. */
export function When({ start, end }: { start: string; end: string }) {
  const tz = useTimeZone();
  return (
    <>
      {formatDay(start, tz)}, {formatTime(start, tz)}–{formatTime(end, tz)}
    </>
  );
}

/** A small calendar tile: month over day number. */
export function DateTile({ iso, muted }: { iso: string; muted?: boolean }) {
  const d = dateParts(iso, useTimeZone());
  return (
    <span
      className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl ${
        muted ? "bg-background text-muted" : "bg-accent-soft text-accent"
      }`}
    >
      <span className="text-[11px] font-medium uppercase leading-none">{d.month}</span>
      <span className="text-lg font-semibold leading-tight tabular-nums">{d.day}</span>
    </span>
  );
}
