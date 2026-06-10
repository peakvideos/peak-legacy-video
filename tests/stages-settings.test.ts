import { expect, test } from "vitest";
import { listStages } from "@/lib/stages";
import { getSettings } from "@/lib/stages/settings";

test("the seeded pipeline reproduces today's eight stages, in order, with their behavior flags", async () => {
  const stages = await listStages();

  expect(stages.map((s) => s.name)).toEqual([
    "New",
    "Stale",
    "Booked a call",
    "Call completed",
    "Video shoot scheduled",
    "Post video shoot",
    "Closed",
    "Lost",
  ]);

  // listStages returns the board order.
  expect(stages.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

  // Won on the paid stage, Lost on the lost stage, Needs-my-action on the
  // two stages where the owner must reply before anything else happens.
  expect(stages.filter((s) => s.isWon).map((s) => s.name)).toEqual(["Closed"]);
  expect(stages.filter((s) => s.isLost).map((s) => s.name)).toEqual(["Lost"]);
  expect(stages.filter((s) => s.needsAction).map((s) => s.name)).toEqual([
    "Call completed",
    "Post video shoot",
  ]);
});

test("settings point at the seeded entry and booking stages, with a 14-day cold threshold and sending not paused", async () => {
  const stages = await listStages();
  const settings = await getSettings();

  const byName = new Map(stages.map((s) => [s.name, s]));
  expect(settings.entryStageId).toBe(byName.get("New")!.id);
  expect(settings.bookingStageId).toBe(byName.get("Booked a call")!.id);
  expect(settings.coldThresholdDays).toBe(14);
  expect(settings.paused).toBe(false);
});
