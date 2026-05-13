import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Unsubscribe — Peak Studios CO",
  robots: { index: false, follow: false, nocache: true },
};

type Outcome =
  | { kind: "unsubscribed"; leadEmail: string }
  | { kind: "already" }
  | { kind: "invalid" };

async function processUnsubscribe(
  leadId: string | undefined,
  token: string | undefined,
): Promise<Outcome> {
  if (!leadId || !token) return { kind: "invalid" };
  if (!verifyUnsubscribeToken(leadId, token)) return { kind: "invalid" };

  const [lead] = await db
    .select({
      email: leads.email,
      unsubscribedAt: leads.unsubscribedAt,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) return { kind: "invalid" };
  if (lead.unsubscribedAt) {
    return { kind: "already" };
  }

  await db
    .update(leads)
    .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  return { kind: "unsubscribed", leadEmail: lead.email };
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; token?: string }>;
}) {
  const sp = await searchParams;
  const outcome = await processUnsubscribe(sp.lead, sp.token);

  return (
    <main className="min-h-screen bg-off-white flex items-center justify-center px-6">
      <div className="bg-white border-t-4 border-gold p-10 max-w-lg w-full">
        {outcome.kind === "unsubscribed" && (
          <>
            <h1 className="font-heading text-forest text-2xl mb-3">
              You&apos;ve been unsubscribed.
            </h1>
            <p className="text-tofino mb-2">
              We&apos;ll stop sending follow-up emails to{" "}
              <span className="text-forest">{outcome.leadEmail}</span>.
            </p>
            <p className="text-tofino italic text-sm">
              If this was a mistake, just reply to any prior email and we&apos;ll
              add you back.
            </p>
          </>
        )}
        {outcome.kind === "already" && (
          <>
            <h1 className="font-heading text-forest text-2xl mb-3">
              You&apos;re already unsubscribed.
            </h1>
            <p className="text-tofino">No further action needed.</p>
          </>
        )}
        {outcome.kind === "invalid" && (
          <>
            <h1 className="font-heading text-forest text-2xl mb-3">
              This link is invalid or expired.
            </h1>
            <p className="text-tofino mb-2">
              Try clicking the link again from your email — if the problem
              persists, reply directly to one of our emails and we&apos;ll
              remove you manually.
            </p>
          </>
        )}
        <p className="mt-6 pt-6 border-t border-forest/10 text-xs text-tofino">
          <Link href="/" className="hover:text-gold">
            ← Back to Peak Studios CO
          </Link>
        </p>
      </div>
    </main>
  );
}
