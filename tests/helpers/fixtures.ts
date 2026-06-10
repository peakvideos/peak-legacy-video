import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  emailJobs,
  emailTemplates,
  leads,
  stageAutomations,
} from "@/lib/db/schema";
import type { LeadStage } from "@/lib/email/sequence";

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

export async function attachAutomation(
  stage: LeadStage,
  templateId: string,
  overrides: Partial<typeof stageAutomations.$inferInsert> = {},
) {
  const [row] = await db
    .insert(stageAutomations)
    .values({ stage, templateId, ...overrides })
    .returning();
  return row;
}

export async function createLead(
  overrides: Partial<typeof leads.$inferInsert> = {},
) {
  seq += 1;
  const [row] = await db
    .insert(leads)
    .values({
      firstName: "Rosie",
      lastName: "Larsen",
      email: `lead-${seq}@example.com`,
      ...overrides,
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
