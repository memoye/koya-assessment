"use client";

import Link from "next/link";
import type { Slot } from "@/lib/types";
import { dateParts, dayKey, formatDay, formatTime, partOfDay, useTimeZone } from "@/lib/time";

/**
 * Days and times for one doctor. The chosen day lives in `?date=` (in the viewer's
 * time zone), so refresh, Back and shared links keep it. Unknown dates fall back to the first day.
 */
export function TimePicker({ slots, date }: { slots: Slot[]; date?: string }) {
  const tz = useTimeZone();
  const days = Map.groupBy(slots, (s) => dayKey(s.start, tz));
  const day = date && days.has(date) ? date : [...days.keys()][0];
  const periods = Map.groupBy(days.get(day)!, (s) => partOfDay(s.start, tz));

  return (
    <>
      <nav aria-label="Date" className="-mx-4 mt-7 flex snap-x gap-2 overflow-x-auto px-4 pb-2">
        {[...days.entries()].map(([key, daySlots]) => {
          const d = dateParts(daySlots[0].start, tz);
          return (
            <Link
              key={key}
              href={`?date=${key}`}
              replace
              scroll={false}
              aria-current={key === day ? "date" : undefined}
              aria-label={formatDay(daySlots[0].start, tz)}
              className="flex w-[60px] shrink-0 snap-start flex-col items-center rounded-md border border-border bg-surface py-2 hover:border-foreground/30 aria-[current=date]:border-accent aria-[current=date]:bg-accent aria-[current=date]:text-on-accent"
            >
              <span className="text-xs opacity-75">{d.weekday}</span>
              <span className="text-lg font-semibold tabular-nums">{d.day}</span>
              <span className="text-xs opacity-75">{d.month}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 space-y-6">
        {[...periods.entries()].map(([period, periodSlots]) => (
          <section key={period}>
            <h2 className="label mb-2">{period}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {periodSlots.map((s) => (
                <Link
                  key={s.id}
                  href={`/book/${encodeURIComponent(s.id)}`}
                  className="flex h-11 items-center justify-center rounded-md border border-border bg-surface font-medium tabular-nums hover:border-accent hover:text-accent"
                >
                  {formatTime(s.start, tz)}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">Times are in {tz.replace(/_/g, " ")} time.</p>
    </>
  );
}
