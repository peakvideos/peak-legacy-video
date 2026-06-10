import { db } from "@/lib/db";
import { settings, stages } from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The eight stages the pipeline shipped with, reproducing the behavior of
 * the old hardcoded enum exactly. The `entry`/`booking` markers say which
 * rows the seeded settings point at — system behavior binds to those
 * pointers and to the flags, never to a stage's name.
 *
 * Kept in sync with the seed statements in the drizzle migration that
 * introduced the stages table; tests re-seed through this module after
 * each truncate.
 */
export const DEFAULT_STAGES = [
  {
    name: "New",
    color: "gold",
    position: 0,
    description: "Fresh leads from the form/booking modal land here.",
    entry: true,
  },
  {
    name: "Stale",
    color: "tofino",
    position: 1,
    description: "Move leads here once they've gone cold.",
  },
  {
    name: "Booked a call",
    color: "gold-soft",
    position: 2,
    description: "Discovery calls scheduled show here.",
    booking: true,
  },
  {
    name: "Call completed",
    color: "sky",
    position: 3,
    description: "Move leads here after the discovery call.",
    needsAction: true,
  },
  {
    name: "Video shoot scheduled",
    color: "moss",
    position: 4,
    description: "Move leads here once the shoot is booked.",
  },
  {
    name: "Post video shoot",
    color: "blush-soft",
    position: 5,
    description: "Move leads here after the shoot wraps.",
    needsAction: true,
  },
  {
    name: "Closed",
    color: "forest",
    position: 6,
    description: "Drop or move leads here once paid.",
    isWon: true,
  },
  {
    name: "Lost",
    color: "blush",
    position: 7,
    description: "Drop or move leads here when they don't convert.",
    isLost: true,
  },
] as const;

/**
 * Inserts the default stages and the single settings row. Assumes both
 * tables are empty (a fresh database, or right after a test truncate).
 */
export async function seedDefaultStagesAndSettings(
  options: { tx?: Tx } = {},
): Promise<void> {
  const runner = options.tx ?? db;

  const rows = await runner
    .insert(stages)
    .values(
      DEFAULT_STAGES.map((s) => ({
        name: s.name,
        color: s.color,
        description: s.description,
        position: s.position,
        isWon: "isWon" in s ? s.isWon : false,
        isLost: "isLost" in s ? s.isLost : false,
        needsAction: "needsAction" in s ? s.needsAction : false,
      })),
    )
    .returning({ id: stages.id, position: stages.position });

  const byPosition = new Map(rows.map((r) => [r.position, r.id]));
  const entryPosition = DEFAULT_STAGES.find((s) => "entry" in s)!.position;
  const bookingPosition = DEFAULT_STAGES.find((s) => "booking" in s)!.position;

  await runner.insert(settings).values({
    entryStageId: byPosition.get(entryPosition)!,
    bookingStageId: byPosition.get(bookingPosition)!,
  });
}
