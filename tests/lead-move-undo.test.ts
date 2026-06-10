import { beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { setLeadStage, undoLeadStageMove } from "@/app/admin/actions";
import { GET as runWorker } from "@/app/api/cron/email-jobs/route";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
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

/** Runs the cron send worker, draining whatever jobs are due. */
async function drainDueJobs() {
  await runWorker(
    new Request("http://localhost:3000/api/cron/email-jobs", {
      headers: { authorization: "Bearer test-cron-secret" },
    }),
  );
}

beforeEach(async () => {
  await signInAsOwner();
});

async function leadStageId(leadId: string) {
  const [row] = await db
    .select({ stageId: leads.stageId })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  return row?.stageId;
}

test("undo restores the lead to the stage it was moved from", async () => {
  const { entryStageId } = await getSettings();
  const callCompleted = await stageByName("Call completed");
  const lead = await createLead();

  const move = await setLeadStage(lead.id, callCompleted.id);
  await undoLeadStageMove(lead.id, move);

  expect(await leadStageId(lead.id)).toBe(entryStageId);
});

test("undo restores the move's cancelled email jobs with their original send times", async () => {
  const { entryStageId } = await getSettings();
  const callCompleted = await stageByName("Call completed");
  const nurture = await createTemplate();
  await attachAutomation(entryStageId, nurture.id);
  const lead = await createLead();
  const originalSendAt = new Date(Date.now() + 60 * MINUTE);
  const queued = await createEmailJob(lead.id, nurture.id, {
    sendAt: originalSendAt,
  });

  const move = await setLeadStage(lead.id, callCompleted.id);
  await undoLeadStageMove(lead.id, move);

  const jobs = await jobsForLead(lead.id);
  const restored = jobs.find((j) => j.id === queued.id);
  expect(restored?.status).toBe("pending");
  expect(restored?.sendAt.getTime()).toBe(originalSendAt.getTime());
});

test("undo removes the email jobs the move scheduled", async () => {
  const callCompleted = await stageByName("Call completed");
  const recap = await createTemplate();
  await attachAutomation(callCompleted.id, recap.id, { delayMinutes: 30 });
  const lead = await createLead();

  const move = await setLeadStage(lead.id, callCompleted.id);
  expect(move.scheduled).toBe(1);

  await undoLeadStageMove(lead.id, move);

  expect(await jobsForLead(lead.id)).toHaveLength(0);
});

test("undo never deletes a scheduled job that has already been sent", async () => {
  const callCompleted = await stageByName("Call completed");
  const recap = await createTemplate();
  await attachAutomation(callCompleted.id, recap.id); // zero delay — due at once
  const lead = await createLead();

  const move = await setLeadStage(lead.id, callCompleted.id);

  // The cron worker drains the due job before the owner clicks Undo.
  await drainDueJobs();

  await undoLeadStageMove(lead.id, move);

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].status).toBe("sent");
});

test("a template the lead already received is never re-scheduled, even on re-entering the same stage", async () => {
  const callCompleted = await stageByName("Call completed");
  const stale = await stageByName("Stale");
  const recap = await createTemplate();
  await attachAutomation(callCompleted.id, recap.id); // zero delay — due at once
  const lead = await createLead();

  await setLeadStage(lead.id, callCompleted.id);
  await drainDueJobs();

  await setLeadStage(lead.id, stale.id);
  const back = await setLeadStage(lead.id, callCompleted.id);

  expect(back.scheduled).toBe(0);
  const jobs = await jobsForLead(lead.id);
  expect(jobs.filter((j) => j.status === "pending")).toHaveLength(0);
  expect(jobs.filter((j) => j.status === "sent")).toHaveLength(1);
});

test("undoing a move requires an authenticated session", async () => {
  const callCompleted = await stageByName("Call completed");
  const lead = await createLead();
  const move = await setLeadStage(lead.id, callCompleted.id);

  resetTestRequestHeaders();

  await expect(undoLeadStageMove(lead.id, move)).rejects.toThrow(
    "Unauthorized",
  );
});
