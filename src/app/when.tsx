"use client";

import { dateParts, formatDay, formatShortDate, formatTime, useTimeZone } from "@/lib/time";

// Client components so dates render in the viewer's time zone.

/** "Monday 16 November, 10:00–10:30" */
export function When({ start, end }: { start: string; end: string }) {
  const tz = useTimeZone();
  return (
    <>
      {formatDay(start, tz)}, {formatTime(start, tz)}–{formatTime(end, tz)}
    </>
  );
}

/** "Mon 16 Nov, 10:00" */
export function ShortDateTime({ iso }: { iso: string }) {
  const tz = useTimeZone();
  return (
    <>
      {formatShortDate(iso, tz)}, {formatTime(iso, tz)}
    </>
  );
}

/** "Monday 16 November" */
export function DayText({ iso }: { iso: string }) {
  return <>{formatDay(iso, useTimeZone())}</>;
}

/** "10:00–10:30" */
export function TimeRange({ start, end }: { start: string; end: string }) {
  const tz = useTimeZone();
  return (
    <>
      {formatTime(start, tz)}–{formatTime(end, tz)}
    </>
  );
}

/** A small calendar tile: month over day number. */
export function DateTile({ iso, muted }: { iso: string; muted?: boolean }) {
  const d = dateParts(iso, useTimeZone());
  return (
    <span
      className={`flex w-11 shrink-0 flex-col items-center rounded-md border py-1 ${
        muted ? "border-border text-muted" : "border-accent/25 bg-accent-soft text-accent"
      }`}
    >
      <span className="text-[11px] font-medium uppercase">{d.month}</span>
      <span className="text-lg leading-tight font-semibold tabular-nums">{d.day}</span>
    </span>
  );
}
