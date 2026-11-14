"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { cancelBooking, createBooking } from "@/lib/service";

/*
 * The web page is a public patient-facing client. It calls the same service
 * layer as the HTTP API (validation, double-booking protection, idempotency
 * and rate limiting all apply) but runs on the server, so the API key never
 * ships to the browser.
 */

export type BookState = {
  error?: string;
  /** A fresh Idempotency-Key for the next submit, so a corrected form isn't a 422. */
  idempotencyKey?: string;
  values?: { name: string; email: string };
};

export async function bookSlot(_prev: BookState, formData: FormData): Promise<BookState> {
  const value = {
    slot_id: String(formData.get("slot_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const idempotencyKey = String(formData.get("idempotency_key") ?? "") || null;

  const result = await createBooking({
    body: { ok: true, raw: JSON.stringify(value), value },
    idempotencyKey,
  });

  if (result.status === 201 && "id" in result.body) {
    redirect(`/booking/${result.body.id}`);
  }

  const message = "error" in result.body ? result.body.error : "Something went wrong";
  const friendly: Record<number, string> = {
    404: "That slot no longer exists. Please pick another.",
    409: "Sorry, someone just booked that slot. Please pick another.",
    429: `Too many booking attempts for this email. Please try again in ${result.headers?.["Retry-After"] ?? "60"} seconds.`,
  };
  return {
    error: friendly[result.status] ?? message.charAt(0).toUpperCase() + message.slice(1) + ".",
    idempotencyKey: randomUUID(),
    values: { name: value.name, email: value.email },
  };
}

export async function cancelBookingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await cancelBooking(id); // 409 (already cancelled) is fine: the page shows the current state.
  redirect(`/booking/${encodeURIComponent(id)}`);
}
