import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";

export type Stage = typeof stages.$inferSelect;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** All stages in board order (by position). */
export async function listStages(options: { tx?: Tx } = {}): Promise<Stage[]> {
  const runner = options.tx ?? db;
  return runner.select().from(stages).orderBy(asc(stages.position));
}
