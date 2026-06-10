# Integration test suite

`pnpm test` runs Vitest integration tests against a **throwaway Postgres
database**: global setup creates a uniquely named database on the local
server (`TEST_DATABASE_URL`, falling back to the `DATABASE_URL` in
`.env.local` — non-local hosts are refused), runs the drizzle migrations
into it, and drops it again after the run. Tables are truncated between
tests, then the default pipeline (the eight seeded stages and the
settings row, from `lib/stages/defaults.ts`) is re-seeded so every test
starts from the stock configuration; test files run sequentially because
they share the database.

## The rules these tests follow

- **Only the SMTP transport is mocked.** `nodemailer` is aliased (in
  `vitest.config.ts`) to the recording fake in `stubs/nodemailer.ts`; assert
  deliveries via `smtp.sent` and program failures with `smtp.failNext`.
  Everything else — database, route handlers, server actions, BetterAuth —
  runs for real.
- **Route handlers are invoked as functions** with a constructed `Request`.
  Server actions get the equivalent treatment: `next/headers` and
  `next/cache` are aliased to thin shims (`stubs/`), and
  `helpers/auth.ts#signInAsOwner` creates a real owner session through
  BetterAuth and points the request context at its cookie.
- **Tests assert external behavior at a seam** — rows created or cancelled
  in `email_jobs`, a lead's stage after an action, rendered subject/body
  output — never internal call patterns. If a refactor keeps behavior
  intact, these tests should keep passing.
- The environment is pinned in `setup.ts` before any app module loads
  (app modules read env at import time). Google Calendar is deliberately
  left unconfigured so the booking route skips event creation; no browser
  automation — the UI stays manually verified.
