import { beforeEach, expect, test } from "vitest";
import { setLeadStage } from "@/app/admin/actions";
import { getSettings } from "@/lib/stages/settings";
import { signInAsOwner } from "./helpers/auth";
import { resetTestRequestHeaders } from "./stubs/next-headers";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  jobsForLead,
  stageByName,
} from "./helpers/fixtures";

const MINUTE = 60_000;

beforeEach(async () => {
  await signInAsOwner();
});

test("moving a lead cancels the departed stage's pending emails and enqueues the new stage's, delays counted from entry", async () => {
  const { entryStageId } = await getSettings();
  const callCompleted = await stageByName("Call completed");
  const nurture = await createTemplate();
  const callRecap = await createTemplate();
  await attachAutomation(entryStageId, nurture.id);
  await attachAutomation(callCompleted.id, callRecap.id, { delayMinutes: 30 });

  const lead = await createLead();
  const queued = await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });

  const before = Date.now();
  await setLeadStage(lead.id, callCompleted.id);

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

test("a move reports its previous stage and how many emails it cancelled and scheduled", async () => {
  const { entryStageId } = await getSettings();
  const callCompleted = await stageByName("Call completed");
  const nurture = await createTemplate();
  const callRecap = await createTemplate();
  await attachAutomation(entryStageId, nurture.id);
  await attachAutomation(callCompleted.id, callRecap.id, { delayMinutes: 30 });

  const lead = await createLead();
  await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });

  const move = await setLeadStage(lead.id, callCompleted.id);

  expect(move.fromStageId).toBe(entryStageId);
  expect(move.cancelled).toBe(1);
  expect(move.scheduled).toBe(1);
});

test("templates the lead has already received are skipped when entering a stage that automates them", async () => {
  const callCompleted = await stageByName("Call completed");
  const recap = await createTemplate();
  const checkIn = await createTemplate();
  await attachAutomation(callCompleted.id, recap.id, { position: 0 });
  await attachAutomation(callCompleted.id, checkIn.id, { position: 1 });

  const lead = await createLead();
  await createEmailJob(lead.id, recap.id, {
    status: "sent",
    sentAt: new Date(),
  });

  await setLeadStage(lead.id, callCompleted.id);

  const jobs = await jobsForLead(lead.id);
  const pending = jobs.filter((j) => j.status === "pending");
  expect(pending).toHaveLength(1);
  expect(pending[0].templateId).toBe(checkIn.id);
});

test("a same-stage move leaves the queued emails alone", async () => {
  const { entryStageId } = await getSettings();
  const nurture = await createTemplate();
  await attachAutomation(entryStageId, nurture.id);
  const lead = await createLead();
  const queued = await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });

  await setLeadStage(lead.id, entryStageId);

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].id).toBe(queued.id);
  expect(jobs[0].status).toBe("pending");
});

test("moving a lead requires an authenticated session", async () => {
  resetTestRequestHeaders();
  const lead = await createLead();
  const stale = await stageByName("Stale");

  await expect(setLeadStage(lead.id, stale.id)).rejects.toThrow("Unauthorized");
});
