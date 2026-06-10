import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  emailJobs,
  emailTemplates,
  leads,
  stageAutomations,
  stages,
} from "@/lib/db/schema";
import { getSettings } from "@/lib/stages/settings";

/** Minimal Tiptap document: one paragraph per string. */
export function tiptapDoc(...paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

let seq = 0;

export async function createTemplate(
  overrides: Partial<typeof emailTemplates.$inferInsert> = {},
) {
  seq += 1;
  const [row] = await db
    .insert(emailTemplates)
    .values({
      slug: `test-template-${seq}`,
      name: `Test template ${seq}`,
      subject: `Test subject ${seq}`,
      body: tiptapDoc(`Hi {{firstName}}, this is test template ${seq}.`),
      ...overrides,
    })
    .returning();
  return row;
}

/** Looks up a seeded stage by name — test setup only; app code binds by id. */
export async function stageByName(name: string) {
  const [row] = await db
    .select()
    .from(stages)
    .where(eq(stages.name, name))
    .limit(1);
  if (!row) throw new Error(`No stage named "${name}"`);
  return row;
}

export async function attachAutomation(
  stageId: string,
  templateId: string,
  overrides: Partial<typeof stageAutomations.$inferInsert> = {},
) {
  const [row] = await db
    .insert(stageAutomations)
    .values({ stageId, templateId, ...overrides })
    .returning();
  return row;
}

export async function createLead(
  overrides: Partial<typeof leads.$inferInsert> = {},
) {
  seq += 1;
  const stageId =
    overrides.stageId ?? (await getSettings()).entryStageId;
  const [row] = await db
    .insert(leads)
    .values({
      firstName: "Rosie",
      lastName: "Larsen",
      email: `lead-${seq}@example.com`,
      ...overrides,
      stageId,
    })
    .returning();
  return row;
}

export async function createEmailJob(
  leadId: string,
  templateId: string,
  overrides: Partial<typeof emailJobs.$inferInsert> = {},
) {
  const [row] = await db
    .insert(emailJobs)
    .values({ leadId, templateId, sendAt: new Date(), ...overrides })
    .returning();
  return row;
}

export async function jobsForLead(leadId: string) {
  return db
    .select()
    .from(emailJobs)
    .where(eq(emailJobs.leadId, leadId))
    .orderBy(emailJobs.sendAt);
}

/** Builds the JSON POST Request a route handler would receive. */
export function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
