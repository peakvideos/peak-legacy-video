import { beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import {
  createStage,
  recolorStage,
  renameStage,
  reorderStages,
} from "@/app/admin/stages/actions";
import { db } from "@/lib/db";
import { leads, stageAutomations } from "@/lib/db/schema";
import { listStages } from "@/lib/stages";
import { getSettings } from "@/lib/stages/settings";
import { POST as submitBooking } from "@/app/api/book/route";
import { signInAsOwner } from "./helpers/auth";
import { resetTestRequestHeaders } from "./stubs/next-headers";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  jobsForLead,
  jsonRequest,
  stageByName,
} from "./helpers/fixtures";

beforeEach(async () => {
  await signInAsOwner();
});

test("the owner can add a stage with a name and color at a chosen position, and the board order absorbs it", async () => {
  await createStage({ name: "Contract sent", color: "sky", position: 3 });

  const stages = await listStages();
  expect(stages.map((s) => s.name)).toEqual([
    "New",
    "Stale",
    "Booked a call",
    "Contract sent",
    "Call completed",
    "Video shoot scheduled",
    "Post video shoot",
    "Closed",
    "Lost",
  ]);
  // Positions stay contiguous so ordering derivations keep working.
  expect(stages.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);

  const added = stages[3];
  expect(added.color).toBe("sky");
  // Owner-created stages carry no seeded empty-column hint or behavior flags.
  expect(added.description).toBeNull();
  expect(added.isWon).toBe(false);
  expect(added.isLost).toBe(false);
  expect(added.needsAction).toBe(false);
});

test("renaming a stage changes only its label — leads, automations, and settings pointers stay attached", async () => {
  // The entry stage is the most entangled: settings point at it, and we
  // give it a lead and an automation before the rename.
  const { entryStageId } = await getSettings();
  const lead = await createLead();
  const nurture = await createTemplate();
  await attachAutomation(entryStageId, nurture.id);

  await renameStage(entryStageId, "Fresh inquiries");

  const stages = await listStages();
  const renamed = stages.find((s) => s.id === entryStageId)!;
  expect(renamed.name).toBe("Fresh inquiries");

  const [leadAfter] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, lead.id));
  expect(leadAfter.stageId).toBe(entryStageId);

  const automations = await db
    .select()
    .from(stageAutomations)
    .where(eq(stageAutomations.stageId, entryStageId));
  expect(automations.map((a) => a.templateId)).toEqual([nurture.id]);

  expect((await getSettings()).entryStageId).toBe(entryStageId);
});

test("recoloring a stage swaps its palette key and touches nothing else about it", async () => {
  const [first] = await listStages();
  expect(first.color).not.toBe("blush");

  await recolorStage(first.id, "blush");

  const after = (await listStages()).find((s) => s.id === first.id)!;
  expect(after.color).toBe("blush");
  expect(after.name).toBe(first.name);
  expect(after.position).toBe(first.position);
  expect(after.description).toBe(first.description);
});

test("reordering rewrites the board order to the given sequence", async () => {
  const before = await listStages();
  // Move "Stale" (slot 1) to just before the terminal stages.
  const reordered = [...before];
  const [stale] = reordered.splice(1, 1);
  reordered.splice(5, 0, stale);

  await reorderStages(reordered.map((s) => s.id));

  const after = await listStages();
  expect(after.map((s) => s.name)).toEqual([
    "New",
    "Booked a call",
    "Call completed",
    "Video shoot scheduled",
    "Post video shoot",
    "Stale",
    "Closed",
    "Lost",
  ]);
  expect(after.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});

test("the new order drives forward-only booking promotion: a stage moved past the Booking Stage stops promoting", async () => {
  // Seeded, "Stale" sits before "Booked a call", so a stale lead who books
  // is promoted. Move "Stale" past the Booking Stage and that same booking
  // must leave the lead where the owner put them.
  const stale = await stageByName("Stale");
  const lead = await createLead({
    email: "rosie@example.com",
    stageId: stale.id,
  });

  const before = await listStages();
  const ids = before.map((s) => s.id).filter((id) => id !== stale.id);
  ids.splice(5, 0, stale.id); // after Booked a call, before the terminals
  await reorderStages(ids);

  const weekday = new Date(Date.now() + 7 * 86_400_000);
  while (weekday.getUTCDay() === 0 || weekday.getUTCDay() === 6) {
    weekday.setUTCDate(weekday.getUTCDate() + 1);
  }
  const res = await submitBooking(
    jsonRequest("/api/book", {
      firstName: "Rosie",
      lastName: "Larsen",
      email: "rosie@example.com",
      packageInterest: "heirloom",
      date: weekday.toISOString().slice(0, 10),
      time: "9:00 AM",
      consent: true,
    }),
  );
  expect(res.status).toBe(200);

  const [leadAfter] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, lead.id));
  expect(leadAfter.stageId).toBe(stale.id);
});

test("add, rename, recolor, and reorder create or cancel no email jobs and move no leads", async () => {
  // A lead in an automated stage with a pending job — the exact setup a
  // stage transition would disturb.
  const { entryStageId } = await getSettings();
  const nurture = await createTemplate();
  await attachAutomation(entryStageId, nurture.id);
  const lead = await createLead();
  const queued = await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * 60_000),
  });

  await createStage({ name: "Contract sent", color: "sky", position: 1 });
  await renameStage(entryStageId, "Fresh inquiries");
  await recolorStage(entryStageId, "moss");
  await reorderStages((await listStages()).map((s) => s.id).reverse());

  const [leadAfter] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, lead.id));
  expect(leadAfter.stageId).toBe(entryStageId);

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].id).toBe(queued.id);
  expect(jobs[0].status).toBe("pending");
});

test("stage management requires an authenticated session", async () => {
  const [stage] = await listStages();
  resetTestRequestHeaders();

  await expect(
    createStage({ name: "X", color: "sky", position: 0 }),
  ).rejects.toThrow("Unauthorized");
  await expect(renameStage(stage.id, "X")).rejects.toThrow("Unauthorized");
  await expect(recolorStage(stage.id, "sky")).rejects.toThrow("Unauthorized");
  await expect(reorderStages([stage.id])).rejects.toThrow("Unauthorized");
});
