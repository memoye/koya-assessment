"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelBookingAction } from "@/app/actions";

/** Cancelling is irreversible, so it takes a second, explicit tap. */
export function CancelButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn btn-secondary w-full text-danger">
        Cancel appointment
      </button>
    );
  }

  return (
    <form action={cancelBookingAction} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary flex-1">
        Keep it
      </button>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn flex-1 bg-danger text-white hover:bg-danger/90">
      {pending ? "Cancelling…" : "Yes, cancel"}
    </button>
  );
}
