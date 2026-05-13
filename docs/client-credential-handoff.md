# Accounts I need set up

A few accounts under your name. You own everything — I just need access to wire it up.

---

## 1. Google (Calendar + admin sign-in)

If you want writes to your `peaklegacyvideos@gmail.com` calendar, we need to setup Google Cloud Console.

Follow [docs/dev/google-calendar-setup.md](dev/google-calendar-setup.md) — it's a click-by-click walkthrough. You'll end up with these 6 values:

```env
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

Send me all 6 of these

---

## 2. Meta Pixel

Tracks landing page views + bookings for ad targeting.

1. Go to <https://business.facebook.com/events_manager2>
2. **Connect Data Source → Web → Meta Pixel → Connect**
3. Name it "Peak Studios CO"
4. Send me the Pixel ID (long number on the dashboard)

---

## 3. Gmail App Password (sending email)

Booking confirmations and drip sequences send from `peaklegacyvideos@gmail.com` directly via Gmail. No third-party service. We just need a one-time **App Password** so the booking system can authenticate as your Gmail.

1. Make sure **2-Step Verification** is on for `peaklegacyvideos@gmail.com`. Check at <https://myaccount.google.com/security> — under "How you sign in to Google", 2-Step Verification should say **On**. Turn it on if it isn't.
2. Go to <https://myaccount.google.com/apppasswords>.
3. App name: "Peak Studios Bookings". Click **Create**.
4. Google shows a 16-character password (e.g. `abcd efgh ijkl mnop`). Copy it — **you can't see it again**.
5. Send it to me via 1Password (along with the Google env values from step 1).

That's it — no signup, no domain verification, no extra account.

---

## 4. Vercel (hosting)

1. Sign up at <https://vercel.com/signup>. Hobby plan is free and fine.
2. I have to setup the rest so you can send me credentials or we meet up

---

## 5. Railway (database)

1. Sign up at <https://railway.com/login> with **Continue with Google**. Free plan should be fine for this too
2. I'll have to setup the rest
