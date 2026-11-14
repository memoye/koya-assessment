export type Slot = {
  id: string;
  provider: string;
  start: string;
  end: string;
};

export type SlotWithAvailability = Slot & { available: boolean };

export type BookingStatus = "confirmed" | "cancelled";

export type Booking = {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: BookingStatus;
  created_at: string;
};

export type ApiError = { error: string };

/**
 * Transport-agnostic result from the service layer. Route handlers turn it into
 * an HTTP Response; server actions (the web UI) read it directly.
 */
export type ApiResult<T> = {
  status: number;
  body: T | ApiError;
  headers?: Record<string, string>;
};
