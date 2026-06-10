import { auth } from "@/lib/auth";
import { setTestRequestHeaders } from "../stubs/next-headers";

/**
 * Creates the Owner account through BetterAuth's real sign-up flow (the test
 * env allows signup for owner@test.local) and points the test request
 * context at the resulting session cookie, so server actions guarded by
 * `requireSession` run against a real session row.
 */
export async function signInAsOwner(): Promise<void> {
  const res = await auth.api.signUpEmail({
    body: {
      email: "owner@test.local",
      password: "test-password-123",
      name: "Marc Black",
    },
    asResponse: true,
  });
  if (!res.ok) {
    throw new Error(`BetterAuth sign-up failed: ${await res.text()}`);
  }
  const cookies = res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0]);
  if (cookies.length === 0) {
    throw new Error("BetterAuth sign-up returned no session cookie.");
  }
  setTestRequestHeaders({ cookie: cookies.join("; ") });
}
