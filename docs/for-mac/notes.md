** For google calendar **

What "won't expire" actually means
Once the app is published, a refresh token lives indefinitely unless one of these happens (per Google's docs):

You revoke access at https://myaccount.google.com/permissions.
The token goes unused for 6 months.
You change the peaklegacyvideos@gmail.com password.
You exceed 50 live refresh tokens for the same client+account (oldest gets evicted — not relevant here, you'll only ever have one).
So in practice: rotate the token only when you want to, not on Google's 7-day timer.

---

Check your meta pixel data
