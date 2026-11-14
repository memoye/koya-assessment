"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * The viewer's time zone. Renders "UTC" on the server and during hydration
 * (so markup matches), then switches to the browser's zone on the client.
 */
export function useTimeZone(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}

export function formatDay(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}

export function dayKey(iso: string, timeZone: string) {
  // en-CA gives YYYY-MM-DD, which sorts and groups cleanly.
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}
