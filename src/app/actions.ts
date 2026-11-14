"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelBooking, createBooking } from "@/lib/service";

// The page calls the service layer directly rather than the HTTP API, so the
// API key never reaches the browser. Every booking rule still applies.

export type BookState = {
  error?: string;
  idempotencyKey?: string; // fresh key for the next submit, so a corrected form isn't a 422
  values?: { name: string; email: string };
};

export async function bookSlot(_prev: BookState, formData: FormData): Promise<BookState> {
  const value = {
    slot_id: String(formData.get("slot_id")),
    name: String(formData.get("name")),
    email: String(formData.get("email")),
  };
  const result = await createBooking({
    body: { ok: true, raw: JSON.stringify(value), value },
    idempotencyKey: String(formData.get("idempotency_key")) || null,
  });

  // Availability changed (booked, or found taken): drop cached pages so lists are fresh.
  if (result.status === 201 || result.status === 404 || result.status === 409) revalidatePath("/", "layout");
  if ("id" in result.body) redirect(`/booking/${result.body.id}`);

  let error = result.body.error;
  if (result.status === 404 || result.status === 409) {
    error = "Sorry, that time was just taken. Please choose another.";
  } else if (result.status === 429) {
    error = `Too many attempts. Try again in ${result.headers?.["Retry-After"]}s.`;
  }

  return {
    error: error.charAt(0).toUpperCase() + error.slice(1),
    idempotencyKey: randomUUID(),
    values: { name: value.name, email: value.email },
  };
}

export async function cancelBookingAction(formData: FormData) {
  const id = String(formData.get("id"));
  await cancelBooking(id); // already cancelled is fine: the page shows the current state
  revalidatePath("/", "layout"); // the slot is free again
  redirect(`/booking/${encodeURIComponent(id)}`);
}
