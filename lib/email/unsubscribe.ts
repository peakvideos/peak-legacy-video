import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-way unsubscribe token. We sign the lead's UUID with the BetterAuth
 * secret so the URL anyone receives in their inbox can't be repurposed to
 * unsubscribe a *different* lead. Truncated to 16 hex chars (64 bits) —
 * plenty for an unsubscribe link.
 */

function hmacKey(): string {
  const key = process.env.BETTER_AUTH_SECRET;
  if (!key) {
    throw new Error(
      "BETTER_AUTH_SECRET is required for unsubscribe-token signing.",
    );
  }
  return key;
}

export function unsubscribeTokenFor(leadId: string): string {
  return createHmac("sha256", hmacKey())
    .update(leadId)
    .digest("hex")
    .slice(0, 16);
}

export function verifyUnsubscribeToken(
  leadId: string,
  token: string,
): boolean {
  const expected = unsubscribeTokenFor(leadId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function unsubscribeUrlFor(leadId: string, baseUrl?: string): string {
  const base =
    baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const token = unsubscribeTokenFor(leadId);
  return `${base}/unsubscribe?lead=${leadId}&token=${token}`;
}
