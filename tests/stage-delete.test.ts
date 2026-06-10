import { beforeEach, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { deleteStage } from "@/app/admin/stages/actions";
import { db } from "@/lib/db";
import { emailTemplates, leads, stageAutomations } from "@/lib/db/schema";
import { listStages } from "@/lib/stages";
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

beforeEach(async () => {
  await signInAsOwner();
});

test("deleting an empty stage no setting points at completes directly", async () => {
  // Seeded, "Stale" holds no leads and neither settings pointer names it.
  const stale = await stageByName("Stale");

  await deleteStage({ stageId: stale.id });

  const after = await listStages();
  expect(after.map((s) => s.name)).toEqual([
    "New",
    "Booked a call",
    "Call completed",
    "Video shoot scheduled",
    "Post video shoot",
    "Closed",
    "Lost",
  ]);
  // Positions close the gap so ordering derivations keep working.
  expect(after.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test("deleting a stage holding leads requires a destination, and every resident lead ends up there", async () => {
  const stale = await stageByName("Stale");
  const callCompleted = await stageByName("Call completed");
  const residents = [
    await createLead({ stageId: stale.id }),
    await createLead({ stageId: stale.id }),
  ];
  // A bystander in another stage must not be swept along.
  const bystander = await createLead({ stageId: callCompleted.id });

  await expect(deleteStage({ stageId: stale.id })).rejects.toThrow(
    /destination/i,
  );
  // A blocked delete leaves the stage on the board.
  expect((await listStages()).some((s) => s.id === stale.id)).toBe(true);

  await deleteStage({
    stageId: stale.id,
    destinationStageId: callCompleted.id,
  });

  expect((await listStages()).some((s) => s.id === stale.id)).toBe(false);
  const relocated = await db
    .select({ id: leads.id, stageId: leads.stageId })
    .from(leads)
    .where(inArray(leads.id, residents.map((l) => l.id)));
  expect(relocated.map((l) => l.stageId)).toEqual([
    callCompleted.id,
    callCompleted.id,
  ]);
  const [untouched] = await db
    .select({ stageId: leads.stageId })
    .from(leads)
    .where(eq(leads.id, bystander.id));
  expect(untouched.stageId).toBe(callCompleted.id);
});

test("relocation enqueues no destination automations by default, and cancels the leads' unsent jobs", async () => {
  const stale = await stageByName("Stale");
  const booked = await stageByName("Booked a call");
  const welcome = await createTemplate();
  await attachAutomation(booked.id, welcome.id);

  // A resident mid-drip: an unsent job queued by the stage being deleted.
  const lead = await createLead({ stageId: stale.id });
  const nurture = await createTemplate();
  const queued = await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * 60_000),
  });

  await deleteStage({ stageId: stale.id, destinationStageId: booked.id });

  // Leaving cancels unsent jobs; the bulk move is not an ordinary lead
  // move, so the destination's automations stay un-enqueued.
  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].id).toBe(queued.id);
  expect(jobs[0].status).toBe("cancelled");
});

test("the opt-in enqueues the destination's automations under normal rules — already-received templates still skipped", async () => {
  const stale = await stageByName("Stale");
  const booked = await stageByName("Booked a call");
  const welcome = await createTemplate();
  const followUp = await createTemplate();
  await attachAutomation(booked.id, welcome.id, { delayMinutes: 0 });
  await attachAutomation(booked.id, followUp.id, {
    delayMinutes: 1440,
    position: 1,
  });

  // This lead already received the welcome template once before.
  const lead = await createLead({ stageId: stale.id });
  await createEmailJob(lead.id, welcome.id, {
    status: "sent",
    sentAt: new Date(),
  });

  await deleteStage({
    stageId: stale.id,
    destinationStageId: booked.id,
    enqueueDestinationAutomations: true,
  });

  const jobs = await jobsForLead(lead.id);
  const pending = jobs.filter((j) => j.status === "pending");
  expect(pending.map((j) => j.templateId)).toEqual([followUp.id]);
  // Delay is anchored at the relocation, like any stage entry.
  expect(pending[0].sendAt.getTime()).toBeGreaterThan(
    Date.now() + 1439 * 60_000,
  );
  // The received welcome stays a one-time send: only the old sent row.
  expect(
    jobs.filter((j) => j.templateId === welcome.id).map((j) => j.status),
  ).toEqual(["sent"]);
});

test("the deleted stage's automations are removed, but their templates survive as unattached", async () => {
  const stale = await stageByName("Stale");
  const nurture = await createTemplate();
  await attachAutomation(stale.id, nurture.id);

  await deleteStage({ stageId: stale.id });

  const orphanedAutomations = await db
    .select()
    .from(stageAutomations)
    .where(eq(stageAutomations.templateId, nurture.id));
  expect(orphanedAutomations).toEqual([]);

  const [survivor] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, nurture.id));
  expect(survivor).toBeDefined();
  expect(survivor.archivedAt).toBeNull();
});

test("deleting the Entry Stage is blocked until the pointer is re-pointed inline", async () => {
  const { entryStageId } = await getSettings();
  const stale = await stageByName("Stale");

  await expect(deleteStage({ stageId: entryStageId })).rejects.toThrow(
    /entry stage/i,
  );
  expect((await listStages()).some((s) => s.id === entryStageId)).toBe(true);

  await deleteStage({ stageId: entryStageId, entryStageId: stale.id });

  expect((await listStages()).some((s) => s.id === entryStageId)).toBe(false);
  expect((await getSettings()).entryStageId).toBe(stale.id);
});

test("deleting the Booking Stage is blocked until the pointer is re-pointed inline", async () => {
  const { bookingStageId } = await getSettings();
  const callCompleted = await stageByName("Call completed");

  await expect(deleteStage({ stageId: bookingStageId })).rejects.toThrow(
    /booking stage/i,
  );

  await deleteStage({
    stageId: bookingStageId,
    bookingStageId: callCompleted.id,
  });

  expect((await listStages()).some((s) => s.id === bookingStageId)).toBe(
    false,
  );
  expect((await getSettings()).bookingStageId).toBe(callCompleted.id);
});

test("a re-point must land on a surviving stage, not the one being deleted", async () => {
  const { entryStageId } = await getSettings();

  await expect(
    deleteStage({ stageId: entryStageId, entryStageId }),
  ).rejects.toThrow(/entry stage/i);
});

test("deleting the last remaining stage is impossible", async () => {
  const { entryStageId, bookingStageId } = await getSettings();

  // Tear the pipeline down to a single stage through the delete flow
  // itself, re-pointing Booking when its stage goes.
  for (const stage of await listStages()) {
    if (stage.id === entryStageId) continue;
    await deleteStage({
      stageId: stage.id,
      bookingStageId: stage.id === bookingStageId ? entryStageId : undefined,
    });
  }
  expect(await listStages()).toHaveLength(1);

  await expect(deleteStage({ stageId: entryStageId })).rejects.toThrow(
    /at least one stage/i,
  );
  expect(await listStages()).toHaveLength(1);
});

test("deleting a stage requires an authenticated session", async () => {
  const stale = await stageByName("Stale");
  resetTestRequestHeaders();

  await expect(deleteStage({ stageId: stale.id })).rejects.toThrow(
    "Unauthorized",
  );
});
