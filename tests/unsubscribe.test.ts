import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { setLeadUnsubscribed } from "@/app/admin/actions";
import UnsubscribePage from "@/app/unsubscribe/page";
import { unsubscribeTokenFor } from "@/lib/email/unsubscribe";
import { signInAsOwner } from "./helpers/auth";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  jobsForLead,
} from "./helpers/fixtures";

async function reloadLead(id: string) {
  const [row] = await db.select().from(leads).where(eq(leads.id, id));
  return row;
}

/** A lead in `new` with two pending automation emails queued. */
async function leadWithPendingEmails() {
  const lead = await createLead({ stage: "new" });
  const first = await createTemplate();
  const second = await createTemplate();
  await attachAutomation("new", first.id, { position: 0 });
  await attachAutomation("new", second.id, { position: 1 });
  await createEmailJob(lead.id, first.id);
  await createEmailJob(lead.id, second.id, {
    sendAt: new Date(Date.now() + 3_600_000),
  });
  return lead;
}

test("unsubscribing a lead from the CRM immediately cancels every pending email", async () => {
  await signInAsOwner();
  const lead = await leadWithPendingEmails();

  await setLeadUnsubscribed(lead.id, true);

  expect((await reloadLead(lead.id)).unsubscribedAt).not.toBeNull();
  const jobs = await jobsForLead(lead.id);
  expect(jobs.map((j) => j.status)).toEqual(["cancelled", "cancelled"]);
});

test("resubscribing clears the flag but does not resurrect cancelled emails", async () => {
  await signInAsOwner();
  const lead = await leadWithPendingEmails();
  await setLeadUnsubscribed(lead.id, true);

  await setLeadUnsubscribed(lead.id, false);

  expect((await reloadLead(lead.id)).unsubscribedAt).toBeNull();
  const jobs = await jobsForLead(lead.id);
  expect(jobs.map((j) => j.status)).toEqual(["cancelled", "cancelled"]);
});

test("a valid emailed unsubscribe link flags the lead; their queued jobs stay put for the worker to suppress", async () => {
  const lead = await leadWithPendingEmails();

  await UnsubscribePage({
    searchParams: Promise.resolve({
      lead: lead.id,
      token: unsubscribeTokenFor(lead.id),
    }),
  });

  expect((await reloadLead(lead.id)).unsubscribedAt).not.toBeNull();
  // Deliberate contrast with the CRM toggle: the public page only sets the
  // flag — pending jobs are cancelled later by the send worker.
  const jobs = await jobsForLead(lead.id);
  expect(jobs.map((j) => j.status)).toEqual(["pending", "pending"]);
});

test("an unsubscribe link with a bad token changes nothing", async () => {
  const lead = await leadWithPendingEmails();

  await UnsubscribePage({
    searchParams: Promise.resolve({
      lead: lead.id,
      token: "0123456789abcdef",
    }),
  });

  expect((await reloadLead(lead.id)).unsubscribedAt).toBeNull();
});
