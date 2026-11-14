<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## This project

Clinic booking API + patient web page. Spec: the OpenAPI contract summarised in README.md.

- All booking rules live in `src/lib/service.ts`. Route handlers (`src/app/**/route.ts`) and server actions (`src/app/actions.ts`) are thin adapters over it; keep them that way.
- Concurrency guarantees are enforced by Postgres (`db/schema.sql`), not app code: the partial unique index prevents double booking; the rate limiter uses a per-email advisory lock. Never replace these with in-memory state; the app runs on serverless.
- `npm run test:contract` must stay green (needs a running server; wipes data via `POST /reset`). Run `npx tsc --noEmit` and `npm run lint` before committing.
