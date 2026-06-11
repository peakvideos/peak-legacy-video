import "server-only";
import { asc, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/db/schema";

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;

export async function listTemplates(options: { archived?: boolean } = {}) {
  const rows = await db
    .select()
    .from(emailTemplates)
    .orderBy(asc(emailTemplates.archivedAt), desc(emailTemplates.updatedAt));
  if (options.archived === true) return rows.filter((r) => r.archivedAt);
  if (options.archived === false) return rows.filter((r) => !r.archivedAt);
  return rows;
}
