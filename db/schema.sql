-- Clinic booking API schema. Idempotent: safe to run repeatedly (npm run db:migrate).

CREATE TABLE IF NOT EXISTS slots (
  id         text PRIMARY KEY,
  provider   text NOT NULL,
  start_at   timestamptz NOT NULL,
  end_at     timestamptz NOT NULL,
  -- The exact strings the client sent to /reset, echoed back verbatim so
  -- "2026-12-10T09:00:00Z" never comes back as "2026-12-10T09:00:00.000Z".
  start_raw  text NOT NULL,
  end_raw    text NOT NULL
);
CREATE INDEX IF NOT EXISTS slots_start_idx    ON slots (start_at, id);
CREATE INDEX IF NOT EXISTS slots_provider_idx ON slots (provider, start_at, id);

CREATE TABLE IF NOT EXISTS bookings (
  id           text PRIMARY KEY,
  -- Monotonic insertion order: a stable, tie-free key for cursor pagination.
  seq          bigserial UNIQUE,
  slot_id      text NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
  name         text NOT NULL,
  email        text NOT NULL,
  status       text NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

-- Level 3: the database itself guarantees at most one *confirmed* booking per
-- slot. Concurrent inserts race on this index and exactly one wins; the rest
-- get a unique_violation (23505), which the API maps to 409. Cancelled
-- bookings are excluded, so cancelling frees the slot for a new booking.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_confirmed_per_slot
  ON bookings (slot_id) WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS bookings_email_seq_idx ON bookings (email, seq);

-- Level 4: Idempotency-Key ledger. A row is claimed (status_code NULL) before
-- the work runs, then filled in with the final response.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key           text PRIMARY KEY,
  request_hash  text NOT NULL,
  status_code   integer,
  response_body jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- Level 5: one row per booking attempt, for a sliding-window rate limit.
CREATE TABLE IF NOT EXISTS booking_attempts (
  id           bigserial PRIMARY KEY,
  email        text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS booking_attempts_email_time_idx
  ON booking_attempts (email, attempted_at);
