# Clinic Booking API

A booking API for a clinic plus a small patient-facing web page that uses it. Built with Next.js 16 (App Router) and Postgres (Neon), deployed on Vercel.

- **Web page:** `/` (soonest appointment, or doctor → date → time → details), `/booking/{id}` (confirmation, add to calendar via `/booking/{id}/calendar`, cancel), `/my-bookings` (paginated lookup by email). Doctors, dates and times all come from the slots in the database; nothing is hard-coded.
- **API:** `POST /reset`, `GET /slots`, `POST /bookings`, `GET /bookings`, `GET /bookings/{id}`, `DELETE /bookings/{id}`. Every API request needs the `X-API-Key` header.

## How each level is met

| Level | Requirement | Implementation |
| --- | --- | --- |
| 1 | List, book, look up | Route handlers in `src/app/**/route.ts` call a transport-agnostic service layer (`src/lib/service.ts`). Slot `start`/`end` are echoed back exactly as sent to `/reset`. |
| 2 | API key, validation | `withApi()` checks `X-API-Key` against `API_KEY` with a constant-time compare and returns 401 before any other work. Inputs are trimmed, emails lower-cased and validated. Checks run in order: 400 (bad input), 404 (unknown slot), 400 (slot already started). |
| 3 | No double booking, even concurrently; cancel | A **partial unique index** `ON bookings (slot_id) WHERE status = 'confirmed'`. Concurrent inserts race at the database, exactly one wins, and the rest get a unique violation that maps to 409. No locks or read-then-write gaps in app code. Cancel is a single conditional `UPDATE … WHERE status = 'confirmed'`, so the index frees the slot automatically. |
| 4 | Idempotent retries; pagination | An `idempotency_keys` ledger. A request claims its key with `INSERT … ON CONFLICT DO NOTHING`, does the work, then stores the status and body. Repeats replay the stored response. A different body under the same key returns 422 (compared by canonical-JSON hash, so key order and whitespace don't matter). A concurrent duplicate waits for the in-flight request and replays its result. 429s and 5xx results are *not* stored, so the client can retry with the same key. Pagination is keyset-based on an insertion sequence (`seq`), with an opaque `next_cursor`. Results stay stable when new rows are added or cancelled, and there is no `OFFSET` scan. |
| 5 | Stop spam | A sliding-window limit of 5 attempts per email per 60s, stored in Postgres so it holds across every serverless instance. Each check runs in a transaction holding a per-email `pg_advisory_xact_lock`, so a burst can't race past the limit and other emails never contend. Failed attempts count. The 429 carries `Retry-After`, the whole seconds until the oldest attempt leaves the window. |

### Decisions worth calling out

- **The rules live in the database.** On serverless there's no shared memory between instances, so anything in-process (a mutex, a `Map` of rate limits) would be wrong. Uniqueness, idempotency and rate limiting all rely on Postgres.
- **Order of checks for `POST /bookings`:** auth, then the idempotency replay, then the rate limit, then validation, then the slot checks, then the insert. Replaying a request the client already made isn't a new attempt, so it doesn't count against the rate limit.
- **The web page doesn't put the API key in the browser.** It's a public page for patients, so it uses Server Actions that call the same service layer as the API. Validation, double-booking protection, rate limiting and idempotency all apply: the form sends an `Idempotency-Key` so a double-click can't double-book. Shipping the key to the client would make it public.
- **`/reset` also clears idempotency records and rate-limit counters,** since they describe bookings that no longer exist.
- **Booking ids are random UUIDs**, so knowing one id doesn't reveal others.

## Run locally

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL and API_KEY
npm run db:migrate                # applies db/schema.sql (safe to re-run)
npm run dev
npm run seed                      # optional: demo slots via POST /reset
```

A throwaway Postgres works fine:

```bash
docker run -d --name koya-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=koya -p 55432:5432 postgres:17-alpine
# DATABASE_URL=postgresql://postgres:postgres@localhost:55432/koya
```

## Tests

`scripts/contract-test.ts` is an end-to-end suite of 52 checks. It runs against any deployment over HTTP and covers every level, including 25 concurrent bookings for one slot, concurrent idempotent retries and a burst of requests against the rate limit.

```bash
BASE_URL=http://localhost:3000 API_KEY=... npm run test:contract
```

> It calls `POST /reset`, which wipes bookings on the target.

## Deploy (Vercel + Neon)

1. Create a Neon project and copy the **pooled** connection string. Alternatively, add Neon from the Vercel Marketplace, which sets `DATABASE_URL` for you.
2. Import the repo into Vercel. Set `DATABASE_URL` and `API_KEY` for the Production environment.
3. Apply the schema once: `DATABASE_URL=<neon url> npm run db:migrate`.
4. Optionally seed demo slots: `BASE_URL=https://<app>.vercel.app API_KEY=... npm run seed`.

## Project layout

```
db/schema.sql                 tables and indexes (the concurrency guarantees live here)
src/lib/service.ts            business logic, shared by the API and the web page
src/lib/validation.ts         input rules
src/lib/http.ts               API-key auth, JSON/error helpers
src/app/{reset,slots,bookings}/…/route.ts   thin HTTP adapters
src/app/page.tsx, slot-picker.tsx, booking/[id], my-bookings   web page
scripts/                      migrate, seed, contract tests
```
