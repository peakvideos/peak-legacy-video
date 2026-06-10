# Send all email from the owner's personal Gmail via SMTP App Password, not an ESP

The original spec named Resend, and the client floated Loops — but the actual requirement is that every email (booking confirmations and nurture drip alike) comes *from* `peaklegacyvideos@gmail.com`, so lead replies land directly in the owner's inbox and the thread continues as a normal 1:1 conversation. An ESP would need a custom sending domain, would break that reply-to-inbox flow, and adds an account + billing surface the owner doesn't want. We send through `smtp.gmail.com` with a Gmail App Password via nodemailer (`lib/email/index.ts`), which is a static credential — no OAuth token lifecycle at all.

## Considered options

- **Resend / Loops (ESP)** — better deliverability tooling, send analytics, no Gmail rate caps. Rejected: requires a sending domain, breaks the from-his-own-gmail requirement, and the reply-handling advantage of plain Gmail outweighs analytics at this volume.
- **Gmail API with OAuth** — same mailbox, but trades a never-expiring App Password for a refresh-token lifecycle (the exact class of fragility we avoid). No benefit at our volume.

## Consequences

- Personal Gmail caps sending at ~500 recipients/day — fine for a single-owner nurture funnel, and the path out (Workspace at 2,000/day, or an ESP swap behind the provider-agnostic `send()` in `lib/email/index.ts`) is known.
- The App Password is revoked by Google if the account password changes or 2-Step Verification is disabled — failure modes and recovery are documented in `docs/dev/gmail-smtp-setup.md`.
- No open/click tracking; the CRM tracks sends only (`email_jobs.status`).
