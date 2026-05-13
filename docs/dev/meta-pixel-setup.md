# Meta Pixel Setup — Peak Studios CO

This document walks the **owner** through getting the Meta Pixel ID we need to plug into the landing page. The Pixel tracks who visits the site and who books a discovery call, which lets Meta optimize ad spend toward people likely to convert.

At the end you'll send your developer:

1. `NEXT_PUBLIC_META_PIXEL_ID` — a 15–16 digit number (e.g. `1234567890123456`)

---

## Step 1 — Open Meta Events Manager

1. Go to <https://business.facebook.com/events_manager>.
2. Sign in with the Facebook account that owns (or will own) the Peak Studios CO ad account.
3. If you don't have a Meta Business account yet, you'll be prompted to create one first. Use your business name and the email you want associated with billing.

## Step 2 — Create the Pixel (a.k.a. "Web Data Source")

1. In Events Manager, sidebar → **Connect Data Sources** → **Web** → **Connect**.
2. Select **Meta Pixel** → **Connect**.
3. Name the dataset **Peak Studios CO Bookings** (anything is fine).
4. Enter the website URL (this can be the temporary Vercel URL or your final domain — doesn't matter, it's metadata).
5. Click **Continue**, then **Skip** any "set up via partner integration" prompts. We're installing the Pixel ourselves through the website code.

## Step 3 — Copy the Pixel ID

1. After creation you land on the dataset's overview page.
2. Find the Pixel ID at the top (under the dataset name) — it's a 15–16 digit number like `1234567890123456`.
3. Copy it.

## Step 4 — Send the value to your developer

Send Bryce one value:

| Key                            | Value                                |
|--------------------------------|--------------------------------------|
| `NEXT_PUBLIC_META_PIXEL_ID`    | The numeric Pixel ID from Step 3     |

(This one isn't a secret — Meta Pixel IDs are visible to anyone who views your site's source. Sending it via Slack or plain email is fine.)

---

## Dev steps once the Pixel ID arrives

When the owner sends the ID, the developer:

1. Open `.env.local` and set:

   ```bash
   NEXT_PUBLIC_META_PIXEL_ID=1234567890123456
   ```

2. Restart the dev server (`pnpm dev`). The pixel base script is conditionally rendered in `app/layout.tsx` and only mounts when this env var is set — the `PageView` event fires automatically on every page load.
3. The booking flow already calls `trackLead()` after a successful `POST /api/book`. No further wiring needed.
4. **Verify in browser**:
   - Open Chrome DevTools → Network tab.
   - Load the landing page. You should see a request to `connect.facebook.net/.../fbevents.js` and a follow-up POST to `facebook.com/tr` with `ev=PageView`.
   - Complete a test booking. After the success screen, another `facebook.com/tr` POST should fire with `ev=Lead`.
5. **Verify in Events Manager**:
   - Events Manager → your dataset → **Test Events** tab.
   - Enter the site URL and click **Open Website**.
   - PageView should appear within seconds; Lead appears after you complete a booking in that browser.
6. For staging/production, set `NEXT_PUBLIC_META_PIXEL_ID` in Vercel project settings → Environment Variables. Vercel needs `NEXT_PUBLIC_*` vars at **build** time, so trigger a redeploy after adding it.

---

## FAQ

**Is the Pixel ID a secret?**
No. It appears in the page source any time someone with browser dev tools loads the site. The `NEXT_PUBLIC_` prefix makes it explicit that this value is bundled client-side.

**What does the Pixel actually send to Meta?**
The base script fires `PageView` on every page load — page URL, referrer, anonymous browser fingerprint. The booking flow additionally fires `Lead` on success — same browser fingerprint, no PII like email or phone (we keep that server-side; the email send goes to Gmail SMTP, Meta does not see it).

**What about iOS users with App Tracking Transparency disabled?**
Meta uses Conversions API + browser-side Pixel together for resilience. We're only doing browser-side here, so iOS opt-outs reduce attribution accuracy somewhat. For Phase 4 this is fine; if attribution becomes a serious problem we can add server-side Conversions API as a follow-up.

**Will this slow down my page?**
The script loads `afterInteractive` (Next.js Script strategy), so it doesn't block initial render or first paint. Total weight is around 75 KB gzipped.
