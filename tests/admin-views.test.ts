import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";
import { updateSettings } from "@/lib/stages/settings";
import { loadSidebarCounts } from "@/lib/admin/sidebar-counts";
import {
  loadActiveLeadRows,
  loadClosedLeadRows,
  loadStuckLeadRows,
} from "@/lib/admin/lead-rows";
import { loadInboxEvents } from "@/lib/admin/inbox-events";
import { createLead, stageByName } from "./helpers/fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

/** A stage row beyond the seeded eight — flags only, no special name. */
async function createStage(
  overrides: Partial<typeof stages.$inferInsert> = {},
) {
  const [row] = await db
    .insert(stages)
    .values({
      name: "Extra stage",
      color: "moss",
      position: 100,
      ...overrides,
    })
    .returning();
  return row;
}

test("active and closed views split leads by the Won/Lost flags, not stage names", async () => {
  const won = await stageByName("Closed");
  const lost = await stageByName("Lost");
  // A second Won-flagged stage proves the binding is the flag.
  const paidInFull = await createStage({ name: "Paid in full", isWon: true });

  const active = await createLead();
  const closedLead = await createLead({ stageId: won.id });
  const paidLead = await createLead({ stageId: paidInFull.id });
  const lostLead = await createLead({ stageId: lost.id });

  const activeRows = await loadActiveLeadRows();
  expect(activeRows.map((r) => r.id)).toEqual([active.id]);

  const wonRows = await loadClosedLeadRows("won");
  expect(wonRows.map((r) => r.id).sort()).toEqual(
    [closedLead.id, paidLead.id].sort(),
  );

  const lostRows = await loadClosedLeadRows("lost");
  expect(lostRows.map((r) => r.id)).toEqual([lostLead.id]);
});

test("sidebar counts bind to the flags and the cold threshold setting", async () => {
  const won = await stageByName("Closed");
  const lost = await stageByName("Lost");

  await createLead(); // active, fresh
  await createLead({ updatedAt: daysAgo(20) }); // active, cold
  await createLead({ stageId: won.id });
  await createLead({ stageId: lost.id, updatedAt: daysAgo(40) }); // terminal — never stuck

  let counts = await loadSidebarCounts();
  expect(counts.inbox).toBe(4);
  expect(counts.active).toBe(2);
  expect(counts.closed).toBe(1);
  expect(counts.stuck).toBe(1);

  // Raising the threshold above 20 days clears the stuck count.
  await updateSettings({ coldThresholdDays: 30 });
  counts = await loadSidebarCounts();
  expect(counts.stuck).toBe(0);
});

test("the stuck view lists non-terminal leads untouched past the cold threshold", async () => {
  const won = await stageByName("Closed");
  const coldLead = await createLead({ updatedAt: daysAgo(15) });
  await createLead({ updatedAt: daysAgo(2) }); // recently touched
  await createLead({ stageId: won.id, updatedAt: daysAgo(15) }); // terminal

  const rows = await loadStuckLeadRows();
  expect(rows.map((r) => r.id)).toEqual([coldLead.id]);
});

test("inbox waiting events come from the Needs-action flag; cold events respect the threshold setting and skip terminal stages", async () => {
  const needy = await createStage({ name: "Awaiting reply", needsAction: true });
  const won = await stageByName("Closed");

  const waiting = await createLead({ stageId: needy.id });
  const cold = await createLead({ updatedAt: daysAgo(15) });
  await createLead({ stageId: won.id, updatedAt: daysAgo(15) }); // terminal: neither

  let events = await loadInboxEvents();
  expect(
    events.filter((e) => e.kind === "waiting").map((e) => e.leadId),
  ).toEqual([waiting.id]);
  expect(events.filter((e) => e.kind === "cold").map((e) => e.leadId)).toEqual(
    [cold.id],
  );

  // Raising the threshold clears the cold event.
  await updateSettings({ coldThresholdDays: 30 });
  events = await loadInboxEvents();
  expect(events.filter((e) => e.kind === "cold")).toHaveLength(0);
});
