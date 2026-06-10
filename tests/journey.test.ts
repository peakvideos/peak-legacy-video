import { expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";
import {
  loadAutomationCountsByStage,
  loadJourney,
} from "@/lib/admin/journey";
import {
  attachAutomation,
  createTemplate,
  stageByName,
} from "./helpers/fixtures";

test("the journey lists every stage in pipeline order with its automations as cards", async () => {
  const entry = await stageByName("New");
  const booked = await stageByName("Booked a call");

  const welcome = await createTemplate({
    name: "Welcome",
    subject: "Welcome to Peak",
  });
  const prep = await createTemplate({
    name: "Call prep",
    subject: "Before our call",
  });

  await attachAutomation(entry.id, welcome.id, { delayMinutes: 0 });
  await attachAutomation(booked.id, prep.id, { delayMinutes: 60 * 24 });

  const journey = await loadJourney();

  expect(journey.stages.map((s) => s.name)).toEqual([
    "New",
    "Stale",
    "Booked a call",
    "Call completed",
    "Video shoot scheduled",
    "Post video shoot",
    "Closed",
    "Lost",
  ]);

  const entryColumn = journey.stages.find((s) => s.id === entry.id)!;
  expect(entryColumn.automations).toEqual([
    expect.objectContaining({
      templateName: "Welcome",
      templateSubject: "Welcome to Peak",
      delayMinutes: 0,
    }),
  ]);

  const bookedColumn = journey.stages.find((s) => s.id === booked.id)!;
  expect(bookedColumn.automations.map((a) => a.templateName)).toEqual([
    "Call prep",
  ]);

  // Stages with nothing attached still appear, just empty.
  const lost = journey.stages.find((s) => s.name === "Lost")!;
  expect(lost.automations).toEqual([]);
});

test("cards within a stage are time-ordered by delay, not by editor position", async () => {
  const entry = await stageByName("New");
  const dayLater = await createTemplate({ name: "Day later" });
  const immediate = await createTemplate({ name: "Immediate" });
  const hourLater = await createTemplate({ name: "Hour later" });

  // Editor positions deliberately disagree with the delays.
  await attachAutomation(entry.id, dayLater.id, {
    delayMinutes: 60 * 24,
    position: 0,
  });
  await attachAutomation(entry.id, immediate.id, {
    delayMinutes: 0,
    position: 1,
  });
  await attachAutomation(entry.id, hourLater.id, {
    delayMinutes: 60,
    position: 2,
  });

  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations.map((a) => a.templateName)).toEqual([
    "Immediate",
    "Hour later",
    "Day later",
  ]);
});

test("templates attached to no stage gather in the unattached shelf, archived ones excluded", async () => {
  const entry = await stageByName("New");
  const attached = await createTemplate({ name: "Attached" });
  const loose = await createTemplate({
    name: "Loose",
    subject: "Nobody sends me yet",
  });
  await createTemplate({ name: "Archived loose", archivedAt: new Date() });
  const archivedAttached = await createTemplate({
    name: "Archived attached",
    archivedAt: new Date(),
  });

  await attachAutomation(entry.id, attached.id, { delayMinutes: 0 });
  await attachAutomation(entry.id, archivedAttached.id, {
    delayMinutes: 60,
    position: 1,
  });

  const journey = await loadJourney();

  expect(journey.unattached).toEqual([
    expect.objectContaining({
      id: loose.id,
      name: "Loose",
      subject: "Nobody sends me yet",
    }),
  ]);

  // An archived template still attached to a stage keeps its card — the
  // sequencer still enqueues it, and the journey reports what leads get.
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations.map((a) => a.templateName)).toEqual([
    "Attached",
    "Archived attached",
  ]);
});

test("renaming, recoloring, and reordering a stage carries its cards along", async () => {
  const entry = await stageByName("New");
  const welcome = await createTemplate({ name: "Welcome" });
  await attachAutomation(entry.id, welcome.id, { delayMinutes: 0 });

  // The board edits the row in place; the journey binds by id, not name.
  await db
    .update(stages)
    .set({ name: "Fresh inquiries", color: "blush", position: 100 })
    .where(eq(stages.id, entry.id));

  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.name).toBe("Fresh inquiries");
  expect(column.color).toBe("blush");
  expect(journey.stages.at(-1)!.id).toBe(entry.id);
  expect(column.automations.map((a) => a.templateName)).toEqual(["Welcome"]);
});

test("automation counts cover every stage, zeroes included, for the board headers", async () => {
  const entry = await stageByName("New");
  const booked = await stageByName("Booked a call");
  const t1 = await createTemplate();
  const t2 = await createTemplate();
  await attachAutomation(entry.id, t1.id, { delayMinutes: 0 });
  await attachAutomation(entry.id, t2.id, { delayMinutes: 60, position: 1 });

  const counts = await loadAutomationCountsByStage();
  expect(counts[entry.id]).toBe(2);
  expect(counts[booked.id]).toBe(0);
  // One entry per stage in the pipeline — eight seeded stages.
  expect(Object.keys(counts)).toHaveLength(8);
});
