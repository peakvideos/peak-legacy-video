# Launch Checklist

End-to-end checklist before flipping the site live. Work top-to-bottom — earlier items unblock later ones.

---

## 1 · Credentials in place

All five integrations need credentials. See [README.md](./README.md) for the per-integration matrix; each guide ends with a "Dev steps once credentials arrive" section.

- [ ] [Google Calendar](./google-calendar-setup.md) — `GOOGLE_CALENDAR_CLIENT_ID`, `_SECRET`, `_REFRESH_TOKEN`, `_ID`
- [ ] [Gmail SMTP](./gmail-smtp-setup.md) — `GMAIL_SMTP_USER`, `GMAIL_SMTP_PASSWORD` (App Password), `EMAIL_FROM`, `OWNER_NOTIFICATION_EMAIL`
- [ ] [Meta Pixel](./meta-pixel-setup.md) — `NEXT_PUBLIC_META_PIXEL_ID`
- [ ] [Owner sign-in](./auth-setup.md) — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OWNER_EMAILS`, `GOOGLE_OAUTH_CLIENT_ID`, `_SECRET`
- [ ] `CRON_SECRET` set (Vercel auto-populates this)
- [ ] `NEXT_PUBLIC_BASE_URL` matches the production domain
- [ ] `NEXT_PUBLIC_NOINDEX` is unset (or `false`) in production — set to `true` only on preview/staging

## 2 · Vercel project

- [ ] Project created and linked to the repo (`vercel link`)
- [ ] Environment variables copied into Vercel project settings (Production scope at minimum; Preview scope for staging deploys)
- [ ] Custom domain added and DNS verified
- [ ] Deploy succeeds (`vercel --prod` or push to main)
- [ ] Confirm `vercel.json` cron is registered in Project → Crons. Should show `*/5 * * * *` for `/api/cron/email-jobs`.

## 3 · End-to-end smoke (production)

Run from a fresh browser session in incognito.

### Path A — lead submits, doesn't book

- [ ] Open the production landing page. Spot-check copy, fonts, and brand colors against [docs/Peak_Studios_CO_Copy_Package.pdf](../Peak_Studios_CO_Copy_Package.pdf).
- [ ] Click any CTA. Modal opens with the right title.
- [ ] Submit step 1 with a real email you can check. Click Next.
- [ ] Close the modal before completing the booking.
- [ ] Check `/admin` — lead row exists, status = `Not yet booked`. Lead detail shows 5 sequence jobs, all `pending`.
- [ ] Wait 5+ minutes for the cron to fire. Email 1 ("Thanks for reaching out…") should arrive.
- [ ] In `/admin/leads/[id]`, step 1 status flips to `sent` with a `sent_at` timestamp.

### Path B — lead submits and books

- [ ] Repeat path A through step 1 (lead captured).
- [ ] Continue through calendar → review → confirm.
- [ ] Confirmation screen shows. Within ~10 seconds:
  - [ ] Lead receives "You're booked in — Peak Studios CO" email.
  - [ ] Owner inbox (`OWNER_NOTIFICATION_EMAIL`) receives "New booking — {first} {last}".
  - [ ] Owner's Google Calendar has the event at the booked PT time, with the lead as attendee, package + notes in the description.
- [ ] In `/admin`, lead status = `Booked`. All 5 sequence jobs flipped to `cancelled`.
- [ ] Cron tick passes without sending anything for this lead.

### Path C — slot conflict

- [ ] Two browsers, same date+time. First books → success. Second tries → 409 "That slot was just booked." User picks another time → success.

### Path D — admin toggle

- [ ] Sign into `/admin` with one of the `OWNER_EMAILS`. Non-allowlisted Google account → consent screen → `FORBIDDEN` error, no user row created.
- [ ] On a lead detail page, click **Mark as Not Booked**. Status flips, sequence restarts (5 fresh `pending` jobs anchored to now). Sent emails stay as historical records.
- [ ] Click **Mark as Booked**. Status flips back, pending jobs cancel.

## 4 · Meta Pixel verification

- [ ] Events Manager → your dataset → **Test Events** tab.
- [ ] Enter the production URL, click **Open Website**.
- [ ] `PageView` appears within seconds.
- [ ] Complete a booking from that browser. `Lead` event fires after the success screen.
- [ ] Pixel sources tab shows the deployed domain (not localhost).

## 5 · Performance

- [ ] Run Lighthouse mobile audit on the landing page (Chrome DevTools → Lighthouse → Mobile, Performance category). Target:
  - LCP < 2.5s (spec wants < 3s)
  - CLS < 0.1
  - FCP < 1.8s
- [ ] If LCP is high, check the Hero — its `min-h-screen` background gradient is GPU-light, but a slow font load can push LCP past target. Both fonts use `display: swap` already.
- [ ] WebPageTest from a 3G mobile profile if you want a tougher number than Lighthouse's local run.

## 6 · SEO + indexing

- [ ] `https://<prod-domain>/robots.txt` should `Allow: /` and `Disallow: /admin /api /sign-in`. (If you see `Disallow: /` for everything, `NEXT_PUBLIC_NOINDEX` is still `true` — unset it and redeploy.)
- [ ] `https://<prod-domain>/sitemap.xml` returns the homepage URL.
- [ ] Submit the production URL to Google Search Console → Inspect URL → Request Indexing.
- [ ] OG tag preview: paste the URL into a Facebook/LinkedIn share dialog and verify the title + description render.

## 7 · Owner walkthrough

Schedule 30 minutes with the owner to walk through:

- [ ] Sign-in flow — they sign into `/admin` with their Google account
- [ ] Dashboard — what each stat means, how to filter by sort
- [ ] Lead detail — where notes, UTM, bookings, and sequence status live
- [ ] How to mark booked / not booked, and what each action does to the email sequence
- [ ] Where booking confirmation emails go (their inbox + lead inbox)
- [ ] Where to block time on Google Calendar to remove slots from the booking page
- [ ] What to do when a lead replies to a sequence email
- [ ] How payments work (manual Wave link after the discovery call — system doesn't process payment)

## 8 · Brand assets

These are placeholders / TODOs the owner controls:

- [ ] Logo files dropped in `public/` (favicon `.ico`, possibly `apple-touch-icon.png`, `og-image.png` for social previews)
- [ ] If a custom OG image is added, register it in `app/layout.tsx` under `openGraph.images`
- [ ] Real photography for any About / Hero treatments the owner wants to add later (currently the design is type-led, no photography)

## 9 · Post-launch monitoring

- [ ] Vercel Logs — check for 5xx in the first 24h
- [ ] Gmail "Sent" folder for `peaklegacyvideos@gmail.com` — confirms emails left the box; bounces show up as bounce-back replies
- [ ] Send a fresh booking-confirmation test to a Gmail / Outlook / Yahoo inbox each — verify it lands in Inbox, not Spam/Promotions
- [ ] `email_jobs` table — query `WHERE status = 'failed'` weekly to spot delivery problems
- [ ] Meta Events Manager — verify Lead conversion events are flowing
