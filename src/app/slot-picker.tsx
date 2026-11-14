"use client";

import { useActionState, useMemo, useState } from "react";
import type { SlotWithAvailability } from "@/lib/types";
import { dayKey, formatDay, formatTime, useTimeZone } from "@/lib/time";
import { bookSlot, type BookState } from "./actions";

type SlotState = "available" | "booked" | "past";

export function SlotPicker({ slots, now }: { slots: SlotWithAvailability[]; now: number }) {
  const tz = useTimeZone();
  const [provider, setProvider] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const providers = useMemo(() => [...new Set(slots.map((s) => s.provider))].sort(), [slots]);

  const days = useMemo(() => {
    const groups = new Map<string, SlotWithAvailability[]>();
    for (const s of slots) {
      if (provider && s.provider !== provider) continue;
      const k = dayKey(s.start, tz);
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    return [...groups.entries()];
  }, [slots, provider, tz]);

  const stateOf = (s: SlotWithAvailability): SlotState =>
    Date.parse(s.start) <= now ? "past" : s.available ? "available" : "booked";

  const selected = slots.find((s) => s.id === selectedId && stateOf(s) === "available") ?? null;

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="font-medium">No appointment slots yet</p>
        <p className="mt-1 text-sm text-muted">Slots appear here once the clinic publishes them.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section aria-label="Available slots" className={selected ? "pb-96 lg:pb-0" : ""}>
        {providers.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by provider">
            {[null, ...providers].map((p) => (
              <button
                key={p ?? "all"}
                type="button"
                onClick={() => setProvider(p)}
                aria-pressed={provider === p}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  provider === p
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-surface text-muted hover:text-foreground"
                }`}
              >
                {p ?? "All providers"}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-8">
          {days.map(([key, daySlots]) => (
            <div key={key}>
              <h2 className="mb-3 text-sm font-medium text-muted">{formatDay(daySlots[0].start, tz)}</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {daySlots.map((s) => {
                  const state = stateOf(s);
                  const isSelected = selected?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={state !== "available"}
                      onClick={() => setSelectedId(s.id)}
                      aria-pressed={isSelected}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-accent bg-accent-soft ring-2 ring-accent"
                          : state === "available"
                            ? "border-border bg-surface hover:border-accent"
                            : "cursor-not-allowed border-border bg-transparent opacity-50"
                      }`}
                    >
                      <span className={`block font-medium tabular-nums ${state === "booked" ? "line-through" : ""}`}>
                        {formatTime(s.start, tz)} – {formatTime(s.end, tz)}
                      </span>
                      <span className="block text-xs text-muted">
                        {state === "available" ? s.provider : state === "booked" ? "Booked" : "Past"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted">Times shown in {tz.replace(/_/g, " ")}.</p>
      </section>

      {/* Desktop: sticky sidebar. Mobile: bottom sheet that appears once a slot is picked. */}
      <aside
        className={`lg:sticky lg:top-6 lg:block lg:self-start ${
          selected ? "fixed inset-x-0 bottom-0 z-10 lg:static" : "hidden"
        }`}
      >
        <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:max-h-none lg:rounded-2xl lg:shadow-sm">
          {selected ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="float-right -mt-1 rounded-md px-2 py-1 text-sm text-muted hover:text-foreground lg:hidden"
              >
                Close
              </button>
              {/* Remount per slot so each selection gets a fresh Idempotency-Key. */}
              <BookingForm key={selected.id} slot={selected} tz={tz} />
            </>
          ) : (
            <div className="py-6 text-center text-sm text-muted">Select a time to book it.</div>
          )}
        </div>
      </aside>
    </div>
  );
}

function BookingForm({ slot, tz }: { slot: SlotWithAvailability; tz: string }) {
  // Generated on the client at mount; the form only exists after a click, so no SSR mismatch.
  const [initialKey] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState<BookState, FormData>(bookSlot, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Your appointment</p>
        <p className="mt-1 font-semibold">{slot.provider}</p>
        <p className="text-sm text-muted">
          {formatDay(slot.start, tz)}, {formatTime(slot.start, tz)} – {formatTime(slot.end, tz)}
        </p>
      </div>

      <input type="hidden" name="slot_id" value={slot.id} />
      <input type="hidden" name="idempotency_key" value={state.idempotencyKey ?? initialKey} />

      <label className="block">
        <span className="text-sm font-medium">Full name</span>
        <input
          name="name"
          required
          autoComplete="name"
          defaultValue={state.values?.name}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.values?.email}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
