import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookings, leads, stages } from "@/lib/db/schema";
import { getSettings } from "@/lib/stages/settings";
import {
  createBookingEvent,
  findSlotByLabel,
  isGoogleCalendarConfigured,
  ptDateTimeToUtc,
  ptToday,
} from "@/lib/google-calendar";
import {
  sendBookingLeadConfirmation,
  sendBookingOwnerNotification,
} from "@/lib/email";
import { transitionLeadStageAutomations } from "@/lib/email/sequence";

export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const utmSchema = z
  .object({
    source: z.string().trim().max(200).optional(),
    medium: z.string().trim().max(200).optional(),
    campaign: z.string().trim().max(200).optional(),
    content: z.string().trim().max(200).optional(),
    term: z.string().trim().max(200).optional(),
  })
  .optional();

const bookBodySchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone: z.string().trim().max(40).optional(),
  packageInterest: z.enum(["legacy", "heirloom", "unsure"]),
  notes: z.string().trim().max(2000).optional(),
  date: z.string().regex(ISO_DATE_RE),
  time: z.string().trim().min(1).max(20),
  consent: z.literal(true),
  utm: utmSchema,
});

const PACKAGE_LABELS: Record<"legacy" | "heirloom" | "unsure", string> = {
  legacy: "The Legacy ($2,500 CAD)",
  heirloom: "The Heirloom ($3,500 CAD)",
  unsure: "Not sure yet",
};

function packageLabel(pkg: "legacy" | "heirloom" | "unsure"): string {
  return PACKAGE_LABELS[pkg];
}

function dateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bookBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // ── Validate slot + date server-side ────────────────────────────
  const slot = findSlotByLabel(body.time);
  if (!slot) {
    return NextResponse.json(
      { error: "Unknown time slot." },
      { status: 400 },
    );
  }

  const [y, mo, d] = body.date.split("-").map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  const validDate =
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === mo - 1 &&
    probe.getUTCDate() === d;
  if (!validDate) {
    return NextResponse.json({ error: "Invalid calendar date." }, { status: 400 });
  }

  const dow = probe.getUTCDay();
  if (dow === 0 || dow === 6) {
    return NextResponse.json(
      { error: "Bookings are Monday through Friday only." },
      { status: 400 },
    );
  }

  if (body.date < ptToday()) {
    return NextResponse.json(
      { error: "That date has already passed." },
      { status: 400 },
    );
  }

  const scheduledAt = ptDateTimeToUtc(body.date, slot.hour, slot.minute);

  // ── DB transaction: upsert lead, create booking, swap automations ──
  let bookingId: string;
  let leadId: string;
  try {
    const result = await db.transaction(async (tx) => {
      const conflict = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.scheduledAt, scheduledAt),
            eq(bookings.status, "scheduled"),
          ),
        )
        .limit(1);
      if (conflict.length > 0) {
        throw new ConflictError("That slot was just booked. Please pick another time.");
      }

      const { bookingStageId } = await getSettings({ tx });
      const [bookingStage] = await tx
        .select({ id: stages.id, position: stages.position })
        .from(stages)
        .where(eq(stages.id, bookingStageId))
        .limit(1);

      const utm = body.utm ?? {};
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
          stageId: bookingStage.id,
        })
        .onConflictDoUpdate({
          target: leads.email,
          set: {
            firstName: body.firstName,
            lastName: body.lastName,
            phone: body.phone || null,
            packageInterest: body.packageInterest,
            notes: body.notes || null,
            // Only overwrite UTM if the new submission has UTM fields
            ...(utm.source && { utmSource: utm.source }),
            ...(utm.medium && { utmMedium: utm.medium }),
            ...(utm.campaign && { utmCampaign: utm.campaign }),
            ...(utm.content && { utmContent: utm.content }),
            ...(utm.term && { utmTerm: utm.term }),
            // Forward-only promotion: a fresh booking moves the lead to the
            // Booking Stage only from stages positioned before it. A lead
            // at or past the Booking Stage keeps the owner's placement.
            stageId: sql`CASE WHEN (SELECT s."position" FROM "stages" s WHERE s."id" = ${leads.stageId}) < ${bookingStage.position} THEN ${bookingStage.id}::uuid ELSE ${leads.stageId} END`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: leads.id, stageId: leads.stageId });

      const [booking] = await tx
        .insert(bookings)
        .values({
          leadId: lead.id,
          scheduledAt,
          status: "scheduled",
        })
        .returning({ id: bookings.id });

      // If this booking left the lead in the Booking Stage, swap whatever
      // drip was queued for the Booking Stage automations. If they were
      // further along, leave the queue alone — sending duplicate "you
      // booked!" emails is worse than silence.
      if (lead.stageId === bookingStage.id) {
        await transitionLeadStageAutomations(lead.id, bookingStage.id, { tx });
      }

      return { leadId: lead.id, bookingId: booking.id };
    });
    leadId = result.leadId;
    bookingId = result.bookingId;
  } catch (err) {
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[book] db transaction failed", err);
    return NextResponse.json(
      { error: "Could not save your booking. Please try again." },
      { status: 500 },
    );
  }

  // ── Side effects: GCal event + emails (best-effort, after commit) ──
  const tplInput = {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    packageLabel: packageLabel(body.packageInterest),
    notes: body.notes,
    dateLabel: dateLabel(body.date),
    timeLabel: body.time,
  };

  let meetLink: string | null = null;
  if (isGoogleCalendarConfigured()) {
    try {
      const event = await createBookingEvent({
        isoDate: body.date,
        slot,
        summary: `Discovery call — ${body.firstName} ${body.lastName}`,
        description: [
          `Lead: ${body.firstName} ${body.lastName}`,
          `Email: ${body.email}`,
          body.phone ? `Phone: ${body.phone}` : null,
          `Package: ${tplInput.packageLabel}`,
          body.notes ? `\nNotes:\n${body.notes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        attendeeEmail: body.email,
      });
      meetLink = event.meetLink;
      if (event.eventId) {
        await db
          .update(bookings)
          .set({ gcalEventId: event.eventId, updatedAt: new Date() })
          .where(eq(bookings.id, bookingId));
      }
    } catch (err) {
      console.error("[book] failed to create GCal event", err);
      // intentionally non-fatal
    }
  } else {
    console.warn("[book] Google Calendar not configured — skipping event creation.");
  }

  // Fire-and-log emails. Don't block success on transient email failures.
  await Promise.all([
    sendBookingLeadConfirmation({ ...tplInput, meetLink }).catch((err) =>
      console.error("[book] lead email error", err),
    ),
    sendBookingOwnerNotification({ ...tplInput, meetLink }).catch((err) =>
      console.error("[book] owner email error", err),
    ),
  ]);

  return NextResponse.json({ ok: true, bookingId, leadId });
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
