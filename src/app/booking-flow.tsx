"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Slot } from "@/lib/types";
import { dateParts, dayKey, formatDay, formatShortDate, formatTime, partOfDay, useTimeZone } from "@/lib/time";
import { bookSlot, type BookState } from "./actions";
import { Avatar } from "./avatar";

type Step = { name: "doctor" } | { name: "time"; provider: string } | { name: "details"; slot: Slot };

/**
 * Doctor → time → details. Every option is derived from the bookable slots
 * (any doctors, any dates, any slot length), so nothing here is hard-coded.
 */
export function BookingFlow({ slots }: { slots: Slot[] }) {
  const byProvider = Map.groupBy(slots, (s) => s.provider);
  const providers = [...byProvider.keys()].sort();
  const single = providers.length === 1;
  const [step, setStepState] = useState<Step>({ name: "doctor" });
  const setStep = (next: Step) => {
    setStepState(next);
    window.scrollTo({ top: 0 });
  };

  if (slots.length === 0) {
    return (
      <>
        <h1>Book an appointment</h1>
        <p className="card mt-6 px-5 py-10 text-center text-muted">No appointments are available right now.</p>
      </>
    );
  }

  if (step.name === "details") {
    return <Details key={step.slot.id} slot={step.slot} onBack={() => setStep({ name: "time", provider: step.slot.provider })} />;
  }

  // With one doctor there's nothing to choose. A doctor whose last slot just went is skipped.
  const provider = single ? providers[0] : step.name === "time" && byProvider.has(step.provider) ? step.provider : null;
  if (provider) {
    return (
      <Times
        key={provider}
        provider={provider}
        slots={byProvider.get(provider)!}
        onBack={single ? undefined : () => setStep({ name: "doctor" })}
        onPick={(slot) => setStep({ name: "details", slot })}
      />
    );
  }

  return (
    <Doctors
      providers={providers}
      byProvider={byProvider}
      onPick={(p) => setStep({ name: "time", provider: p })}
      onSoonest={(slot) => setStep({ name: "details", slot })}
    />
  );
}

function Doctors({
  providers,
  byProvider,
  onPick,
  onSoonest,
}: {
  providers: string[];
  byProvider: Map<string, Slot[]>;
  onPick: (provider: string) => void;
  onSoonest: (slot: Slot) => void;
}) {
  const tz = useTimeZone();
  // Slots arrive earliest-first, so each doctor's first slot is their next opening.
  const soonest = providers.map((p) => byProvider.get(p)![0]).sort((a, b) => a.start.localeCompare(b.start))[0];

  return (
    <>
      <h1>Book an appointment</h1>

      <div className="card mt-6 flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="label">Soonest appointment</p>
          <p className="mt-0.5 font-medium">
            {formatShortDate(soonest.start, tz)}, {formatTime(soonest.start, tz)}
          </p>
          <p className="text-sm text-muted">{soonest.provider}</p>
        </div>
        <button onClick={() => onSoonest(soonest)} className="btn btn-primary">
          Book
        </button>
      </div>

      <h2 className="label mt-8 mb-2">Or choose a doctor</h2>
      <ul className="card divide-y divide-border">
        {providers.map((p) => {
          const next = byProvider.get(p)![0];
          return (
            <li key={p}>
              <button onClick={() => onPick(p)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-background">
                <Avatar name={p} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p}</span>
                  <span className="block text-sm text-muted">
                    Next available {formatShortDate(next.start, tz)}, {formatTime(next.start, tz)}
                  </span>
                </span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Times({
  provider,
  slots,
  onBack,
  onPick,
}: {
  provider: string;
  slots: Slot[];
  onBack?: () => void;
  onPick: (slot: Slot) => void;
}) {
  const tz = useTimeZone();
  const days = Map.groupBy(slots, (s) => dayKey(s.start, tz));
  const [chosen, setDay] = useState<string>();
  const day = chosen && days.has(chosen) ? chosen : [...days.keys()][0];
  const periods = Map.groupBy(days.get(day) ?? [], (s) => partOfDay(s.start, tz));

  return (
    <>
      {onBack && <BackButton onClick={onBack}>All doctors</BackButton>}
      <div className="flex items-center gap-3.5">
        <Avatar name={provider} size={48} />
        <h1>{provider}</h1>
      </div>

      <div role="radiogroup" aria-label="Date" className="-mx-4 mt-7 flex snap-x gap-2 overflow-x-auto px-4 pb-2">
        {[...days.entries()].map(([key, daySlots]) => {
          const d = dateParts(daySlots[0].start, tz);
          return (
            <button
              key={key}
              role="radio"
              aria-checked={key === day}
              aria-label={formatDay(daySlots[0].start, tz)}
              onClick={() => setDay(key)}
              className="flex w-[60px] shrink-0 snap-start flex-col items-center rounded-md border border-border bg-surface py-2 hover:border-foreground/30 aria-checked:border-accent aria-checked:bg-accent aria-checked:text-on-accent"
            >
              <span className="text-xs opacity-75">{d.weekday}</span>
              <span className="text-lg font-semibold tabular-nums">{d.day}</span>
              <span className="text-xs opacity-75">{d.month}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-6">
        {[...periods.entries()].map(([period, periodSlots]) => (
          <section key={period}>
            <h2 className="label mb-2">{period}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {periodSlots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPick(s)}
                  className="h-11 rounded-md border border-border bg-surface font-medium tabular-nums hover:border-accent hover:text-accent"
                >
                  {formatTime(s.start, tz)}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">Times are in {tz.replace(/_/g, " ")} time.</p>
    </>
  );
}

function Details({ slot, onBack }: { slot: Slot; onBack: () => void }) {
  const tz = useTimeZone();
  const [initialKey] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState<BookState, FormData>(bookSlot, {});

  return (
    <>
      <BackButton onClick={onBack}>Back</BackButton>
      <h1>Your details</h1>

      <div className="card mt-6 flex items-center gap-3.5 p-4">
        <Avatar name={slot.provider} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{slot.provider}</p>
          <p className="text-sm text-muted">
            {formatDay(slot.start, tz)}, {formatTime(slot.start, tz)}–{formatTime(slot.end, tz)}
          </p>
        </div>
        <button onClick={onBack} className="text-sm font-medium text-accent hover:underline">
          Change
        </button>
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="slot_id" value={slot.id} />
        <input type="hidden" name="idempotency_key" value={state.idempotencyKey ?? initialKey} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Full name</span>
          <input name="name" required autoComplete="name" defaultValue={state.values?.name} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" defaultValue={state.values?.email} className="field" />
        </label>

        {state.error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {state.error}
          </p>
        )}

        <button disabled={pending} className="btn btn-primary w-full">
          {pending ? "Booking…" : "Confirm booking"}
        </button>
      </form>
    </>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mb-5 -ml-1 flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
      <ArrowLeft size={16} aria-hidden />
      {children}
    </button>
  );
}
