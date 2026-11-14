"use client";

import { useActionState, useRef, useState } from "react";
import { CalendarDays, Stethoscope } from "lucide-react";
import type { Slot } from "@/lib/types";
import { dateParts, dayKey, formatDay, formatTime, useTimeZone } from "@/lib/time";
import { bookSlot, type BookState } from "./actions";

export function SlotPicker({ slots }: { slots: Slot[] }) {
  const tz = useTimeZone();
  const [chosenProvider, setProvider] = useState<string>();
  const [chosenDay, setDay] = useState<string>();
  const [selected, setSelected] = useState<Slot | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  if (slots.length === 0) {
    return (
      <div className="card mt-8 flex flex-col items-center gap-3 px-6 py-14 text-center">
        <CalendarDays className="text-muted" size={28} aria-hidden />
        <p className="font-medium">No appointments available right now</p>
      </div>
    );
  }

  // Fall back to the first option whenever a choice disappears (e.g. its last slot was taken).
  const providers = [...new Set(slots.map((s) => s.provider))].sort();
  const provider = chosenProvider && providers.includes(chosenProvider) ? chosenProvider : providers[0];
  const days = Map.groupBy(
    slots.filter((s) => s.provider === provider),
    (s) => dayKey(s.start, tz),
  );
  const day = chosenDay && days.has(chosenDay) ? chosenDay : [...days.keys()][0];

  return (
    <div className="mt-8 space-y-8">
      {providers.length > 1 && (
        <Step title="Doctor">
          <div role="radiogroup" aria-label="Doctor" className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={p === provider}
                onClick={() => setProvider(p)}
                className="h-11 rounded-full border border-border bg-surface px-5 text-[15px] font-medium transition-colors hover:border-accent aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:text-accent"
              >
                {p}
              </button>
            ))}
          </div>
        </Step>
      )}

      <Step title="Date">
        <div role="radiogroup" aria-label="Date" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
          {[...days.entries()].map(([key, daySlots]) => {
            const d = dateParts(daySlots[0].start, tz);
            return (
              <button
                key={key}
                role="radio"
                aria-checked={key === day}
                aria-label={formatDay(daySlots[0].start, tz)}
                onClick={() => setDay(key)}
                className="flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border border-border bg-surface py-2.5 transition-colors hover:border-accent aria-checked:border-accent aria-checked:bg-accent aria-checked:text-on-accent"
              >
                <span className="text-xs font-medium uppercase opacity-70">{d.weekday}</span>
                <span className="text-xl font-semibold tabular-nums">{d.day}</span>
                <span className="text-xs opacity-70">{d.month}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step title="Time">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {(days.get(day) ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelected(s);
                dialog.current?.showModal();
              }}
              className="h-12 rounded-xl border border-border bg-surface text-[15px] font-medium tabular-nums transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
            >
              {formatTime(s.start, tz)}
            </button>
          ))}
        </div>
      </Step>

      <dialog
        ref={dialog}
        onClose={() => setSelected(null)}
        className="mx-0 mt-auto mb-0 w-full max-w-full rounded-t-3xl bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-md sm:rounded-3xl"
      >
        {/* Keyed per slot: each selection starts a fresh form and Idempotency-Key. */}
        {selected && <BookingForm key={selected.id} slot={selected} tz={tz} onCancel={() => dialog.current?.close()} />}
      </dialog>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-muted">{title}</h2>
      {children}
    </section>
  );
}

function BookingForm({ slot, tz, onCancel }: { slot: Slot; tz: string; onCancel: () => void }) {
  const [initialKey] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState<BookState, FormData>(bookSlot, {});

  return (
    <form action={formAction}>
      <h2 className="text-lg font-semibold">Confirm your appointment</h2>

      <div className="mt-4 space-y-2 rounded-2xl bg-background p-4 text-[15px]">
        <p className="flex items-center gap-2.5">
          <Stethoscope size={17} className="text-muted" aria-hidden />
          {slot.provider}
        </p>
        <p className="flex items-center gap-2.5">
          <CalendarDays size={17} className="text-muted" aria-hidden />
          {formatDay(slot.start, tz)}, {formatTime(slot.start, tz)}–{formatTime(slot.end, tz)}
        </p>
      </div>

      <input type="hidden" name="slot_id" value={slot.id} />
      <input type="hidden" name="idempotency_key" value={state.idempotencyKey ?? initialKey} />

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Full name</span>
          <input name="name" required autoComplete="name" defaultValue={state.values?.name} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" defaultValue={state.values?.email} className="field" />
        </label>
      </div>

      {state.error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">
          Back
        </button>
        <button disabled={pending} className="btn btn-primary flex-1">
          {pending ? "Booking…" : "Book"}
        </button>
      </div>
    </form>
  );
}
