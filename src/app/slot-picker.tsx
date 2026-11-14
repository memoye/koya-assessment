"use client";

import { useActionState, useRef, useState } from "react";
import type { Slot } from "@/lib/types";
import { dayKey, formatDay, formatTime, useTimeZone } from "@/lib/time";
import { bookSlot, type BookState } from "./actions";

export function SlotPicker({ slots }: { slots: Slot[] }) {
  const tz = useTimeZone();
  const providers = [...new Set(slots.map((s) => s.provider))].sort();
  const [chosen, setProvider] = useState(providers[0]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  if (slots.length === 0) {
    return <p className="mt-8 text-muted">No slots available.</p>;
  }

  // The chosen provider can vanish when their last slot is taken.
  const provider = providers.includes(chosen) ? chosen : providers[0];
  const days = Map.groupBy(
    slots.filter((s) => s.provider === provider),
    (s) => dayKey(s.start, tz),
  );

  return (
    <>
      {providers.length > 1 && (
        <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto rounded-lg bg-border/50 p-1">
          {providers.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={p === provider}
              onClick={() => setProvider(p)}
              className="flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted aria-selected:bg-surface aria-selected:text-foreground aria-selected:shadow-sm"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {[...days.values()].map((daySlots) => (
        <section key={daySlots[0].id} className="mt-8">
          <h2 className="text-sm font-medium text-muted">{formatDay(daySlots[0].start, tz)}</h2>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {daySlots.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelected(s);
                  dialog.current?.showModal();
                }}
                className="rounded-lg border border-border bg-surface py-2 text-sm font-medium tabular-nums hover:border-foreground"
              >
                {formatTime(s.start, tz)}
              </button>
            ))}
          </div>
        </section>
      ))}

      <dialog
        ref={dialog}
        onClose={() => setSelected(null)}
        className="m-auto w-[min(100%-2rem,24rem)] rounded-2xl bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/50"
      >
        {/* Keyed per slot: each selection starts a fresh form and Idempotency-Key. */}
        {selected && <BookingForm key={selected.id} slot={selected} tz={tz} onCancel={() => dialog.current?.close()} />}
      </dialog>
    </>
  );
}

function BookingForm({ slot, tz, onCancel }: { slot: Slot; tz: string; onCancel: () => void }) {
  const [initialKey] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState<BookState, FormData>(bookSlot, {});

  return (
    <form action={formAction}>
      <h2 className="font-semibold">{slot.provider}</h2>
      <p className="text-sm text-muted">
        {formatDay(slot.start, tz)}, {formatTime(slot.start, tz)}–{formatTime(slot.end, tz)}
      </p>

      <input type="hidden" name="slot_id" value={slot.id} />
      <input type="hidden" name="idempotency_key" value={state.idempotencyKey ?? initialKey} />

      <div className="mt-5 space-y-2">
        <input name="name" required autoComplete="name" placeholder="Name" aria-label="Name" defaultValue={state.values?.name} className="field" />
        <input name="email" type="email" required autoComplete="email" placeholder="Email" aria-label="Email" defaultValue={state.values?.email} className="field" />
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onCancel} className="btn flex-1 border border-border">
          Cancel
        </button>
        <button disabled={pending} className="btn flex-1 bg-foreground text-background disabled:opacity-50">
          {pending ? "Booking…" : "Book"}
        </button>
      </div>
    </form>
  );
}
