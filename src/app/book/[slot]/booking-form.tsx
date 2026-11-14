"use client";

import { useActionState } from "react";
import { bookSlot, type BookState } from "@/app/actions";

export function BookingForm({ slotId, idempotencyKey }: { slotId: string; idempotencyKey: string }) {
  const [state, formAction, pending] = useActionState<BookState, FormData>(bookSlot, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="slot_id" value={slotId} />
      <input type="hidden" name="idempotency_key" value={state.idempotencyKey ?? idempotencyKey} />
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
  );
}
