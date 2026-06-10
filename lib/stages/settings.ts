import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export type Settings = typeof settings.$inferSelect;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Reads the single settings row. The row is created by the migration that
 * seeded the stages table; its absence means migrations haven't run.
 */
export async function getSettings(options: { tx?: Tx } = {}): Promise<Settings> {
  const runner = options.tx ?? db;
  const [row] = await runner
    .select()
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  if (!row) {
    throw new Error("Settings row missing — run the database migrations.");
  }
  return row;
}

/** Partially updates the settings row; omitted fields are untouched. */
export async function updateSettings(
  patch: Partial<
    Pick<
      Settings,
      "entryStageId" | "bookingStageId" | "coldThresholdDays" | "paused"
    >
  >,
  options: { tx?: Tx } = {},
): Promise<Settings> {
  const runner = options.tx ?? db;
  const [row] = await runner
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();
  if (!row) {
    throw new Error("Settings row missing — run the database migrations.");
  }
  return row;
}
