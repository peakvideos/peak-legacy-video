import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";
import type { StageRow } from "@/lib/admin/stages";

export type Stage = typeof stages.$inferSelect;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** All stages in board order (by position). */
export async function listStages(options: { tx?: Tx } = {}): Promise<Stage[]> {
  const runner = options.tx ?? db;
  return runner.select().from(stages).orderBy(asc(stages.position));
}

/** All stages in board order, in the serializable shape the admin UI takes. */
export async function listStageRows(
  options: { tx?: Tx } = {},
): Promise<StageRow[]> {
  const rows = await listStages(options);
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    description: s.description,
    position: s.position,
    isWon: s.isWon,
    isLost: s.isLost,
    needsAction: s.needsAction,
  }));
}
