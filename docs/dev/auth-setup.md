# Owner Auth (Google Sign-In) Setup — Peak Studios CO

This document covers the owner sign-in flow for the `/admin` dashboard. Sign-in is **Google OAuth only**, and gated by an email allowlist — only the addresses listed in `OWNER_EMAILS` (comma-separated) can sign in.

You will end up sending your developer:

1. `GOOGLE_OAUTH_CLIENT_ID` (sign-in OAuth client)
2. `GOOGLE_OAUTH_CLIENT_SECRET` (sign-in OAuth client)

(The developer also generates a `BETTER_AUTH_SECRET` locally — that's not something you need to provide.)

> This is a **separate** Google OAuth client from the one in [google-calendar-setup.md](./google-calendar-setup.md). They have different redirect URIs and serve different purposes (one is for reading your calendar API server-side; this one is for letting you sign in to the dashboard). You can reuse the same Google Cloud project, just create a new OAuth client inside it.

Sign in to all of the following with `peaklegacyvideos@gmail.com`.

---

## Step 1 — Open the Google Cloud project

Use the same project you set up for the calendar (`Peak Studios Bookings` or whatever you named it). Go to <https://console.cloud.google.com/> and select it from the top bar.

If you haven't done the calendar setup yet, see [google-calendar-setup.md](./google-calendar-setup.md) Steps 1–3 first to create the project and configure the consent screen. You can stop after Step 3 there and come back here.

## Step 2 — Create a new OAuth 2.0 Client for sign-in

1. Sidebar → **APIs & Services → Credentials**.
2. Click **+ Create credentials → OAuth client ID**.
3. **Application type**: Web application.
4. **Name**: "Bookings Dashboard Sign-In".
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:

   ```
   http://localhost:3000
   ```

   When the site is deployed, also add the production origin (e.g. `https://peaklegacyvideos.com`).

6. Under **Authorized redirect URIs**, click **+ Add URI** and add:

   ```
   http://localhost:3000/api/auth/callback/google
   ```

   When deployed, also add the production callback (e.g. `https://peaklegacyvideos.com/api/auth/callback/google`).

7. Click **Create**.
8. Copy the **Client ID** and **Client secret** that appear.

## Step 3 — Send two values to your developer

Send Bryce **securely** (1Password, signed Slack DM, encrypted email):

| Key                            | Where you got it |
|--------------------------------|------------------|
| `GOOGLE_OAUTH_CLIENT_ID`       | Step 2           |
| `GOOGLE_OAUTH_CLIENT_SECRET`   | Step 2           |

---

## Dev steps once credentials arrive

When the owner sends the values, the developer:

1. Generate a Better Auth secret:

   ```bash
   openssl rand -base64 32
   ```

2. Open `.env.local` and set:

   ```bash
   BETTER_AUTH_SECRET=<paste-output-of-openssl-above>
   BETTER_AUTH_URL=http://localhost:3000
   OWNER_EMAILS=peaklegacyvideos@gmail.com,eppler97@gmail.com
   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```

3. Restart the dev server (`pnpm dev`).
4. **Verify the redirect**: visit <http://localhost:3000/admin>. You should be redirected to `/sign-in`.
5. Click **Continue with Google**, sign in with `peaklegacyvideos@gmail.com`, accept the consent prompt. You should land back on `/admin` with the dashboard rendered.
6. **Verify the allowlist**: sign out, then sign in with a different Google account (use a personal one). Better Auth's allowlist hook will throw a `FORBIDDEN` error and refuse to create a user. The DB will not have a row for that account.
7. For staging/production, set the same five vars in Vercel project settings → Environment Variables. Update `BETTER_AUTH_URL` and the OAuth client's redirect URI to the production hostname.

---

## Dev-only shortcut: email + password

To avoid going through Google OAuth every time you test the dashboard locally, the app enables email+password sign-in **only when `NODE_ENV !== "production"`**. The same allowlist hook applies — only emails in `OWNER_EMAILS` can ever sign in.

### Seed a local dev account

```bash
pnpm db:seed
```

This:

- Picks the **first email** from `OWNER_EMAILS` (or `DEV_USER_EMAIL` if set)
- Creates a user with the password `devpass1234` (override via `DEV_USER_PASSWORD`)
- Marks `email_verified=true` so you don't hit a verification gate
- Refuses to run when `NODE_ENV=production`
- Skips silently if the user already exists

### Sign in

Visit <http://localhost:3000/sign-in>. Below the Google button there's a **"Dev only · email + password"** form. Use the seeded credentials. The form is conditionally rendered on `process.env.NODE_ENV !== "production"`, so it disappears in production builds.

### Reset

```bash
psql $DATABASE_URL -c "DELETE FROM users WHERE email='eppler97@gmail.com';"
pnpm db:seed
```

(Cascades clean up the related `sessions` and `accounts` rows.)

---

## FAQ

**Why a separate OAuth client from the Calendar one?**
The Calendar client is a long-lived server-to-server connection (refresh-token flow, Calendar scope). The sign-in client is a per-session user-flow (auth-code flow, profile/email scope). Different redirect URIs. Could be the same client technically; cleaner to keep them separate.

**What if I want to add or remove a person later?**
`OWNER_EMAILS` is comma-separated, so add their Google address to the env var (locally and in Vercel) and redeploy. Removing is the same — drop their email from the list. Existing rows for revoked users stay in `users`/`accounts` but they can no longer sign in or refresh sessions.

**What if I lose access to `peaklegacyvideos@gmail.com`?**
You'd be locked out of the dashboard. Recovery options: (a) recover the Google account, (b) change `OWNER_EMAILS` to a different Google address you control and redeploy.

**Is this account stored in the database?**
Yes — Better Auth creates rows in `users`, `sessions`, and `accounts` (with the OAuth tokens) on first sign-in. Sessions expire and refresh automatically; you'll stay signed in across browser restarts unless you sign out or your session is over a week old.
