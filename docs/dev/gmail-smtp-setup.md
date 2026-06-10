# Gmail SMTP Setup — Peak Studios CO

This document walks the **owner** through setting up Gmail SMTP, which is what the booking system uses to send confirmation emails to leads, owner notifications when a lead books, and the nurture-email sequence to leads who don't book right away.

At the end you'll send your developer:

1. `GMAIL_SMTP_PASSWORD` — a 16-character Gmail App Password (no spaces)

The other values (`GMAIL_SMTP_USER`, `EMAIL_FROM`) we already know.

You only do this once.

---

## Why Gmail SMTP and not a transactional service like Resend?

Gmail won't let outside services send mail "from" `@gmail.com`. The cheapest, simplest path that keeps your inbox identity intact is to authenticate as the Gmail account directly. Personal Gmail allows ~500 sends per day — well above the volume a small business needs for nurture emails.

Tradeoffs vs. a transactional ESP: no delivery dashboard, no webhook events for opens/clicks, harder to debug bounces. For your volume those don't matter much; if they ever do, we'll move to a verified domain on a real ESP.

## Step 1 — Make sure 2-Step Verification is on

Gmail App Passwords are only available on accounts with 2-Step Verification enabled.

1. Sign in to <https://myaccount.google.com/security> as `peaklegacyvideos@gmail.com`.
2. Find **"How you sign in to Google"** → **2-Step Verification**. It should say **On**.
3. If it's off, click in and turn it on (Google will walk you through phone-number verification).

## Step 2 — Generate an App Password

1. Go to <https://myaccount.google.com/apppasswords>.
2. Under **App name**, type `Peak Studios Bookings`. (The name is just a label — pick anything memorable.)
3. Click **Create**.
4. Google shows a 16-character password in a yellow box, formatted like `abcd efgh ijkl mnop`. Copy it now — Google **won't show it again**. If you lose it, you can revoke and regenerate from the same page.

## Step 3 — Send the password to your developer

Send it via 1Password / Bitwarden / signed Slack DM — never plain email. Strip the spaces or leave them; nodemailer accepts both.

The dev will plug it into:

```env
GMAIL_SMTP_USER=peaklegacyvideos@gmail.com
GMAIL_SMTP_PASSWORD=<your 16-char app password>
EMAIL_FROM="Peak Studios CO <peaklegacyvideos@gmail.com>"
OWNER_NOTIFICATION_EMAIL=peaklegacyvideos@gmail.com
```

---

## Dev steps once credentials arrive

1. Drop the four env vars into `.env.local` for local dev and into Vercel project settings (Production scope, plus Preview if you want preview deploys to send).
2. Restart the dev server (`pnpm dev`) and trigger a booking — confirm the lead receives the booking confirmation and the owner inbox receives the notification.
3. Trigger the cron locally:

   ```bash
   curl -X POST http://localhost:3000/api/cron/email-jobs \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

   Confirm any due nurture emails go out and `email_jobs.status` flips from `pending` → `sent`.
4. Send yourself a copy of every template (`/admin/settings/templates/<id>` → click through to the lead detail and force-send via test) and verify each lands in **Inbox**, not Spam or Promotions, on Gmail / Outlook / Yahoo.

## Failure modes to know about

- **Wrong password** → `Invalid login: 535-5.7.8 Username and Password not accepted`. Regenerate the App Password and update env.
- **2-Step Verification disabled** → can't generate App Passwords at all. The Apps Passwords page returns a 403-ish UI. Turn 2SV on first.
- **Rate limit** (≥500 sends in 24h on personal Gmail) → SMTP refuses connections, nodemailer throws. The cron's existing retry-with-backoff handles short bursts; sustained overage means we need to migrate to a domain on an ESP. Workspace ($7/user/mo) raises the cap to 2,000/day if it ever becomes a problem.
- **Account suspended for unusual activity** → Google emails the owner; they click "this was me" to reinstate. Unlikely at our volume.
- **App Password silently revoked** → App Passwords don't expire on a schedule, but Google deletes them when the account password changes or 2-Step Verification is turned off. If the owner ever changes his Google password, regenerate the App Password and update `GMAIL_SMTP_PASSWORD` the same day — queued emails retry with backoff, so nothing is lost if it's fixed within a few hours.

## Notes

- The booking flow's "from" address and Reply-To are the same Gmail. Replies from leads land in `peaklegacyvideos@gmail.com` directly — they aren't ingested by the CRM.
- `EMAIL_FROM` accepts a friendly display name format like `"Peak Studios CO <peaklegacyvideos@gmail.com>"`. Most email clients render only the display name; the address is visible in headers and in "show original".
- If the owner ever buys a domain and wants email-from-domain instead, we swap `lib/email/index.ts` to use the domain SMTP server (e.g. via Workspace) or pivot to a real ESP. The rest of the system is provider-agnostic.
