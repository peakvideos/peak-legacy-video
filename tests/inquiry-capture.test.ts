import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { emailJobs, leads } from "@/lib/db/schema";
import { POST as submitInquiry } from "@/app/api/lead/route";
import {
  attachAutomation,
  createLead,
  createTemplate,
  jobsForLead,
  jsonRequest,
} from "./helpers/fixtures";

const MINUTE = 60_000;

function inquiry(overrides: Record<string, unknown> = {}) {
  return jsonRequest("/api/lead", {
    firstName: "Rosie",
    lastName: "Larsen",
    email: "rosie@example.com",
    packageInterest: "legacy",
    ...overrides,
  });
}

test("a new inquiry lands in the new stage and enqueues that stage's automations", async () => {
  const welcome = await createTemplate();
  const followUp = await createTemplate();
  await attachAutomation("new", welcome.id, { delayMinutes: 5, position: 0 });
  await attachAutomation("new", followUp.id, {
    delayMinutes: 60 * 24,
    position: 1,
  });

  const before = Date.now();
  const res = await submitInquiry(inquiry({ email: "Rosie@Example.com" }));

  expect(res.status).toBe(200);
  const payload = await res.json();
  expect(payload.ok).toBe(true);

  const allLeads = await db.select().from(leads);
  expect(allLeads).toHaveLength(1);
  const lead = allLeads[0];
  expect(lead.id).toBe(payload.leadId);
  expect(lead.stage).toBe("new");
  expect(lead.email).toBe("rosie@example.com"); // stored lowercased

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(2);
  expect(jobs.map((j) => j.status)).toEqual(["pending", "pending"]);
  expect(jobs.map((j) => j.templateId)).toEqual([welcome.id, followUp.id]);

  // Delays are anchored to submission time.
  const after = Date.now();
  expect(jobs[0].sendAt.getTime()).toBeGreaterThanOrEqual(before + 5 * MINUTE);
  expect(jobs[0].sendAt.getTime()).toBeLessThanOrEqual(after + 5 * MINUTE);
  expect(jobs[1].sendAt.getTime()).toBeGreaterThanOrEqual(
    before + 24 * 60 * MINUTE,
  );
});

test("re-submitting while further along the funnel updates contact details but never moves the lead back or re-enqueues", async () => {
  const welcome = await createTemplate();
  await attachAutomation("new", welcome.id);
  const lead = await createLead({
    email: "rosie@example.com",
    stage: "booked_a_call",
    phone: null,
  });

  const res = await submitInquiry(
    inquiry({ phone: "555-0101", notes: "Checking in again" }),
  );

  expect(res.status).toBe(200);
  expect((await res.json()).leadId).toBe(lead.id);

  const [updated] = await db.select().from(leads);
  expect(updated.stage).toBe("booked_a_call");
  expect(updated.phone).toBe("555-0101");
  expect(updated.notes).toBe("Checking in again");

  expect(await jobsForLead(lead.id)).toHaveLength(0);
});

test("re-submitting while still in the new stage does not duplicate queued or already-sent emails", async () => {
  const welcome = await createTemplate();
  await attachAutomation("new", welcome.id, { delayMinutes: 5 });

  await submitInquiry(inquiry());
  const [first] = await db.select().from(leads);
  const jobsAfterFirst = await jobsForLead(first.id);
  expect(jobsAfterFirst).toHaveLength(1);

  // Second submission while the welcome email is still pending: no new row.
  const res = await submitInquiry(inquiry());
  expect(res.status).toBe(200);
  expect(await jobsForLead(first.id)).toHaveLength(1);

  // Third submission after the welcome email went out: still no new row.
  await db
    .update(emailJobs)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(emailJobs.id, jobsAfterFirst[0].id));
  await submitInquiry(inquiry());
  const finalJobs = await jobsForLead(first.id);
  expect(finalJobs).toHaveLength(1);
  expect(finalJobs[0].status).toBe("sent");
});

test("re-submitting while parked in stale keeps the lead in stale with nothing enqueued", async () => {
  const welcome = await createTemplate();
  await attachAutomation("new", welcome.id);
  const lead = await createLead({ email: "rosie@example.com", stage: "stale" });

  const res = await submitInquiry(inquiry());

  expect(res.status).toBe(200);
  const [updated] = await db.select().from(leads);
  expect(updated.stage).toBe("stale");
  expect(await jobsForLead(lead.id)).toHaveLength(0);
});

test("UTM attribution is first-touch: blank re-submissions keep the original values, new values overwrite", async () => {
  await submitInquiry(
    inquiry({ utm: { source: "instagram", campaign: "spring" } }),
  );

  // Re-submission without UTM keeps the original attribution.
  await submitInquiry(inquiry());
  let [lead] = await db.select().from(leads);
  expect(lead.utmSource).toBe("instagram");
  expect(lead.utmCampaign).toBe("spring");

  // Re-submission carrying new UTM values overwrites just those fields.
  await submitInquiry(inquiry({ utm: { source: "facebook" } }));
  [lead] = await db.select().from(leads);
  expect(lead.utmSource).toBe("facebook");
  expect(lead.utmCampaign).toBe("spring");
});
