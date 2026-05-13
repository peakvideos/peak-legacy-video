import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { enqueueAutomationsForStage } from "@/lib/email/sequence";

export const dynamic = "force-dynamic";

const utmSchema = z
  .object({
    source: z.string().trim().max(200).optional(),
    medium: z.string().trim().max(200).optional(),
    campaign: z.string().trim().max(200).optional(),
    content: z.string().trim().max(200).optional(),
    term: z.string().trim().max(200).optional(),
  })
  .optional();

const leadBodySchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone: z.string().trim().max(40).optional(),
  packageInterest: z.enum(["legacy", "heirloom", "unsure"]),
  notes: z.string().trim().max(2000).optional(),
  utm: utmSchema,
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = leadBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const utm = body.utm ?? {};

  try {
    const result = await db.transaction(async (tx) => {
      const [lead] = await tx
        .insert(leads)
        .values({
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email.toLowerCase(),
          phone: body.phone || null,
          packageInterest: body.packageInterest,
          notes: body.notes || null,
          source: "landing_page",
          utmSource: utm.source || null,
          utmMedium: utm.medium || null,
          utmCampaign: utm.campaign || null,
          utmContent: utm.content || null,
          utmTerm: utm.term || null,
          stage: "new",
        })
        .onConflictDoUpdate({
          target: leads.email,
          set: {
            firstName: body.firstName,
            lastName: body.lastName,
            phone: body.phone || null,
            packageInterest: body.packageInterest,
            notes: body.notes || null,
            // First-touch UTM attribution: only overwrite when this submission
            // brought new UTM values.
            ...(utm.source && { utmSource: utm.source }),
            ...(utm.medium && { utmMedium: utm.medium }),
            ...(utm.campaign && { utmCampaign: utm.campaign }),
            ...(utm.content && { utmContent: utm.content }),
            ...(utm.term && { utmTerm: utm.term }),
            updatedAt: new Date(),
          },
        })
        .returning({ id: leads.id, stage: leads.stage });

      // Form-only path: only run the new-stage automations when this is a
      // fresh lead (or someone we'd already classified as new). Don't
      // disturb a lead who's already further along in the funnel — or one
      // the owner has explicitly parked in `stale`.
      if (lead.stage === "new") {
        await enqueueAutomationsForStage(lead.id, "new", { tx });
      }

      return { leadId: lead.id };
    });

    return NextResponse.json({ ok: true, leadId: result.leadId });
  } catch (err) {
    console.error("[lead] failed to capture", err);
    return NextResponse.json(
      { error: "Could not save your details. Please try again." },
      { status: 500 },
    );
  }
}
