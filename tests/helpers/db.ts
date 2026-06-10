import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

let tableList: string | null = null;

/**
 * Empties every application table between tests. The table list is read from
 * the live schema so new tables are covered without touching this file.
 */
export async function resetDatabase(): Promise<void> {
  if (!tableList) {
    const rows = await db.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    );
    tableList = rows.map((r) => `"${r.tablename}"`).join(", ");
  }
  if (tableList) {
    await db.execute(sql.raw(`truncate table ${tableList} restart identity cascade`));
  }
}
