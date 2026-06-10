import { beforeEach, expect, test } from "vitest";
import { setLeadStage } from "@/app/admin/actions";
import { signInAsOwner } from "./helpers/auth";
import { resetTestRequestHeaders } from "./stubs/next-headers";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  jobsForLead,
} from "./helpers/fixtures";

const MINUTE = 60_000;

beforeEach(async () => {
  await signInAsOwner();
});

test("moving a lead cancels the departed stage's pending emails and enqueues the new stage's, delays counted from entry", async () => {
  const nurture = await createTemplate();
  const callRecap = await createTemplate();
  await attachAutomation("new", nurture.id);
  await attachAutomation("call_completed", callRecap.id, { delayMinutes: 30 });

  const lead = await createLead({ stage: "new" });
  const queued = await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });

  const before = Date.now();
  await setLeadStage(lead.id, "call_completed");

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(2);

  const cancelled = jobs.find((j) => j.id === queued.id);
  expect(cancelled?.status).toBe("cancelled");

  const enqueued = jobs.find((j) => j.templateId === callRecap.id);
  expect(enqueued?.status).toBe("pending");
  expect(enqueued!.sendAt.getTime()).toBeGreaterThanOrEqual(
    before + 30 * MINUTE,
  );
  expect(enqueued!.sendAt.getTime()).toBeLessThanOrEqual(
    Date.now() + 30 * MINUTE + 1000,
  );
});

test("templates the lead has already received are skipped when entering a stage that automates them", async () => {
  const recap = await createTemplate();
  const checkIn = await createTemplate();
  await attachAutomation("call_completed", recap.id, { position: 0 });
  await attachAutomation("call_completed", checkIn.id, { position: 1 });

  const lead = await createLead({ stage: "new" });
  await createEmailJob(lead.id, recap.id, {
    status: "sent",
    sentAt: new Date(),
  });

  await setLeadStage(lead.id, "call_completed");

  const jobs = await jobsForLead(lead.id);
  const pending = jobs.filter((j) => j.status === "pending");
  expect(pending).toHaveLength(1);
  expect(pending[0].templateId).toBe(checkIn.id);
});

test("a same-stage move leaves the queued emails alone", async () => {
  const nurture = await createTemplate();
  await attachAutomation("new", nurture.id);
  const lead = await createLead({ stage: "new" });
  const queued = await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });

  await setLeadStage(lead.id, "new");

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].id).toBe(queued.id);
  expect(jobs[0].status).toBe("pending");
});

test("moving a lead requires an authenticated session", async () => {
  resetTestRequestHeaders();
  const lead = await createLead({ stage: "new" });

  await expect(setLeadStage(lead.id, "stale")).rejects.toThrow("Unauthorized");
});
