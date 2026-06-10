@AGENTS.md

# Project: Peak Studios CO Legacy Video

Inbound sales system: landing page + booking modal + owner CRM + email sequences. See `docs/` for the full spec and `docs/dev/build-order.md` for the phased build plan.

## Stack

- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Fonts:** Alata (headings) + Cardo (body), via `next/font/google`
- **Database:** PostgreSQL on Railway
- **ORM:** Drizzle
- **Auth:** BetterAuth — owner-only, gates the CRM dashboard. Leads do not have accounts.
- **Email:** Resend (transactional + sequence drip)
- **Calendar:** Google Calendar API v3 with OAuth 2.0 — source of truth for availability against `peaklegacyvideos@gmail.com`
- **Analytics:** Meta Pixel (PageView on load, Lead on booking)
- **Hosting:** Vercel (web) + Railway (Postgres)
- **Package manager:** pnpm

## Brand tokens

Define these in Tailwind:

| Name         | Hex       | Usage                                  |
|--------------|-----------|----------------------------------------|
| forest       | #233415   | Primary background, dominant UI        |
| forest-deep  | #1a2710   | Deeper background variant              |
| gold         | #CEA64A   | CTAs, highlights, accents              |
| gold-light   | #e0b85a   | Hover state for gold                   |
| moss         | #93A888   | Subtle backgrounds, dividers           |
| blush        | #D8A48F   | Warm accents, emotional sections       |
| tofino       | #597B7E   | Supporting text, secondary elements    |
| sky          | #C7D8E4   | Light backgrounds, form areas          |
| sky-light    | #EDF3F7   | Lighter sky variant                    |
| off-white    | #F8F6F1   | Page background                        |

## Out of scope

- Payment processing (owner sends Wave link manually after the discovery call)
- Lead-facing accounts/login
- Rescheduling UI (leads reply to email)

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (peakvideos/peak-legacy-video) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default names (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
