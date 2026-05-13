"use server";

import { cookies } from "next/headers";
import { ADMIN_THEME_COOKIE, type Theme } from "@/lib/admin/theme";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persist the admin's chosen theme via a `Set-Cookie` response header.
 * Using a server action (vs. `document.cookie`) sidesteps client-side
 * cookie write failures from extensions, strict browser settings, and
 * Safari ITP — the browser commits the cookie like any other response
 * cookie.
 */
export async function setAdminTheme(theme: Theme) {
  const store = await cookies();
  store.set(ADMIN_THEME_COOKIE, theme, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false,
  });
}
