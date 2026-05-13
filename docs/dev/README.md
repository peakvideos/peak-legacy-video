# Dev docs

Internal notes for building and operating the Peak Studios CO booking system.

## Build plan

- [build-order.md](./build-order.md) — phased delivery plan (Phase 0 through Phase 7).
- [launch-checklist.md](./launch-checklist.md) — pre-launch + post-launch operational checklist.

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

## Where to set env vars

- **Local dev**: `.env.local` at the project root (git-ignored). See `.env.example` for the full list.
- **Vercel**: Project settings → Environment Variables. `NEXT_PUBLIC_*` vars are inlined at build time, so add those before the deploy.

## Scheduled tasks

`vercel.json` registers one cron: `POST /api/cron/email-jobs` every 5 minutes. The route reads `CRON_SECRET` from the env and rejects any request whose `Authorization: Bearer <secret>` header doesn't match.

- **On Vercel**: Vercel automatically populates `CRON_SECRET` and sends it as the bearer token on every cron invocation. No setup beyond having the env var present.
- **Locally**: set any value in `.env.local` (`openssl rand -base64 32`), then trigger manually:

  ```bash
  curl -X POST http://localhost:3000/api/cron/email-jobs \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

  The endpoint picks up at most 25 due jobs per call, sends each via Gmail SMTP, retries failures with backoff (1m → 5m → 30m → 2h → 6h, then `failed`), and marks already-booked leads' jobs as `cancelled`.
