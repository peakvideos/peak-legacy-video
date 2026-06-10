# Dev docs

Internal notes for building and operating the Peak Studios CO booking system.

## Build plan

- [build-order.md](./build-order.md) — phased delivery plan (Phase 0 through Phase 7).
- [launch-checklist.md](./launch-checklist.md) — pre-launch + post-launch operational checklist.

## Architecture decisions

- [ADR 0001](../adr/0001-gmail-smtp-over-esp.md) — why email sends from the owner's personal Gmail (SMTP App Password) instead of an ESP like Resend.

## Third-party setup guides

Each integration we depend on has a setup guide written for the **owner** (non-technical) plus a **"Dev steps once credentials arrive"** section at the end of each doc that tells the developer what to do when the values land.

| Integration | What it does | Doc | Required env vars |
| --- | --- | --- | --- |
| Google Calendar | Source of truth for available booking slots; receives created events | [google-calendar-setup.md](./google-calendar-setup.md) | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID` |
| Gmail SMTP | Sends booking confirmations, owner notifications, and nurture drip | [gmail-smtp-setup.md](./gmail-smtp-setup.md) | `GMAIL_SMTP_USER`, `GMAIL_SMTP_PASSWORD`, `EMAIL_FROM`, `OWNER_NOTIFICATION_EMAIL` |
| Meta Pixel | Tracks PageView + Lead events for Meta ad optimization | [meta-pixel-setup.md](./meta-pixel-setup.md) | `NEXT_PUBLIC_META_PIXEL_ID` |
| Owner sign-in (Google OAuth) | Gates the `/admin` dashboard; allowlists a single Google email | [auth-setup.md](./auth-setup.md) | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OWNER_EMAIL`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` |

## Graceful degradation

The codebase is intentionally written so that **missing credentials don't break local dev or the booking flow**. Each integration falls back cleanly:

- **No Google Calendar creds** → `/api/availability` returns all 16 slots; `POST /api/book` skips event creation but still saves the lead + booking row.
- **No Gmail SMTP creds** → emails are silently skipped, with a `console.warn` per send.
- **No Meta Pixel ID** → the base script tag isn't rendered; `trackLead()` is a no-op.

This means you can ship Phase 4 end-to-end with credentials still pending, and turn each integration on independently as the values come in.

## Database migrations

Production migrations apply **automatically during the production deploy**:
`vercel.json` pins the build command to `pnpm build:vercel`, which runs
`pnpm db:migrate` before `next build` — but only when `VERCEL_ENV` is
`production`. Merging a PR that contains a migration applies it as the
production build starts; if the migration fails, the build fails and the
previous deployment stays live.

- **Preview deploys do not migrate.** A PR's preview build skips the
  migrate step entirely, so an unmerged migration can never touch the
  production database.
- **Local `pnpm build` is untouched** (`VERCEL_ENV` is unset). Apply
  migrations locally with `pnpm db:migrate` as before.
- Because `vercel.json`'s `buildCommand` overrides the dashboard's Build
  Command setting, the pipeline behavior is governed by this repo — don't
  re-add a Build Command override in the Vercel project settings.
- Write migrations to ship dark (new code tolerates the old schema and
  vice versa): the migration runs at build time, a few minutes before the
  new code starts serving, and an aborted build leaves the schema migrated
  under the old deployment.
- Emergency manual run against production:
  `DATABASE_URL=<railway prod url> pnpm exec drizzle-kit migrate`
  (drizzle records applied migrations in `__drizzle_migrations`, so
  re-running is a no-op).

## Where to set env vars

- **Local dev**: `.env.local` at the project root (git-ignored). See `.env.example` for the full list.
- **Vercel**: Project settings → Environment Variables. `NEXT_PUBLIC_*` vars are inlined at build time, so add those before the deploy.

## Scheduled tasks

The email queue (`/api/cron/email-jobs`) is triggered by a **Railway cron function** in the owner's Railway account (Peak Studios, `peaklegacyvideos@gmail.com`). Its source is checked into this repo at [`railway/email-cron.ts`](../../railway/email-cron.ts) — edit it there and deploy with `railway functions push -p railway/email-cron.ts` (from a directory linked to the project; one-time setup: `railway link`, then `railway functions link --function function-bun --path railway/email-cron.ts`).

- **Project**: Peak Legacy Video (same project that hosts the production Postgres)
- **Service**: `function-bun` — a Railway Function (Bun) on a 5-minute cron schedule
- **What it does**: (1) POSTs `${APP_BASE_URL}/api/cron/email-jobs` with an `Authorization: Bearer ${CRON_SECRET}` header to drain the queue, then (2) probes `${APP_BASE_URL}/api/health`. If either fails, the run exits non-zero, which Railway surfaces as a failed deployment — enable deploy-failure notifications in the Railway workspace settings to get emailed about it. (A 404 from `/api/health` only warns, so the function works before the health endpoint ships.)
- **Its env vars**: `APP_BASE_URL` and `CRON_SECRET`
- **Caveat**: the watchdog lives inside Railway — if Railway or the function itself stops running, nothing alerts. An external pinger on `/api/health` (UptimeRobot et al.) remains an optional extra layer.

The route reads `CRON_SECRET` from the Vercel env and rejects any request whose `Authorization: Bearer <secret>` header doesn't match exactly.

Two hard-won operational gotchas (both caused a silent multi-week outage in May–June 2026):

1. **`APP_BASE_URL` must be `https://www.peaklegacyvideos.com` — with the `www`.** The apex domain 307-redirects to `www`, and `fetch`/`curl` strip the `Authorization` header on cross-host redirects, so every request lands unauthenticated and gets a 401.
2. **The `CRON_SECRET` values on Railway and Vercel must match byte-for-byte** — no surrounding quotes, no trailing newline. Note that `vercel env pull` cannot read this project's values back (it returns empty strings for all encrypted vars), so don't use it to verify. Verify functionally instead:

  ```bash
  curl -s -w "\nHTTP %{http_code}\n" \
    -H "Authorization: Bearer $CRON_SECRET" \
    https://www.peaklegacyvideos.com/api/cron/email-jobs
  # expect: {"ok":true,"picked":N,...} HTTP 200
  ```

- **Locally**: set any value in `.env.local` (`openssl rand -base64 32`), then trigger manually:

  ```bash
  curl -X POST http://localhost:3000/api/cron/email-jobs \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

  The endpoint picks up at most 25 due jobs per call, sends each via Gmail SMTP, retries failures with backoff (1m → 5m → 30m → 2h → 6h, then `failed`), and marks already-booked leads' jobs as `cancelled`.

There is **no Vercel cron** — Vercel's Hobby plan caps crons at once per day, so the queue is drained from Railway instead. (`vercel.json` exists again, but only to pin the build command for migrations — keep crons out of it.)
