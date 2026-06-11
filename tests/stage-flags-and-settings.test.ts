import { beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { setLeadStage } from "@/app/admin/actions";
import { updatePipelineSettings } from "@/app/admin/settings/pipeline/actions";
import { setStageFlags } from "@/app/admin/stages/actions";
import { POST as submitBooking } from "@/app/api/book/route";
import { POST as submitInquiry } from "@/app/api/lead/route";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { loadInboxEvents } from "@/lib/admin/inbox-events";
import {
  loadActiveLeadRows,
  loadClosedLeadRows,
  loadStuckLeadRows,
} from "@/lib/admin/lead-rows";
import { loadSidebarCounts } from "@/lib/admin/sidebar-counts";
import { listStages } from "@/lib/stages";
import { getSettings } from "@/lib/stages/settings";
import { signInAsOwner } from "./helpers/auth";
import { resetTestRequestHeaders } from "./stubs/next-headers";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  jobsForLead,
  jsonRequest,
  stageByName,
} from "./helpers/fixtures";

beforeEach(async () => {
  await signInAsOwner();
});

test("the owner can toggle behavior flags on a stage, and only the flags change", async () => {
  // "Video shoot scheduled" is seeded flagless — the kind of stage the
  // owner would promote to a terminal or waiting role.
  const stage = await stageByName("Video shoot scheduled");

  await setStageFlags(stage.id, { isWon: true });

  let after = (await listStages()).find((s) => s.id === stage.id)!;
  expect(after.isWon).toBe(true);
  expect(after.isLost).toBe(false);
  expect(after.needsAction).toBe(false);
  expect(after.name).toBe(stage.name);
  expect(after.color).toBe(stage.color);
  expect(after.position).toBe(stage.position);

  // Flags toggle independently and off again.
  await setStageFlags(stage.id, { isWon: false, needsAction: true });

  after = (await listStages()).find((s) => s.id === stage.id)!;
  expect(after.isWon).toBe(false);
  expect(after.isLost).toBe(false);
  expect(after.needsAction).toBe(true);
});

test("flagging a stage Won reclassifies its resident leads: out of the active view and counts, into the Closed view", async () => {
  const stage = await stageByName("Video shoot scheduled");
  const lead = await createLead({ stageId: stage.id });

  let activeIds = (await loadActiveLeadRows()).map((r) => r.id);
  expect(activeIds).toContain(lead.id);
  expect((await loadClosedLeadRows("won")).map((r) => r.id)).toEqual([]);
  expect((await loadSidebarCounts()).closed).toBe(0);

  await setStageFlags(stage.id, { isWon: true });

  activeIds = (await loadActiveLeadRows()).map((r) => r.id);
  expect(activeIds).not.toContain(lead.id);
  expect((await loadClosedLeadRows("won")).map((r) => r.id)).toEqual([
    lead.id,
  ]);
  const counts = await loadSidebarCounts();
  expect(counts.active).toBe(0);
  expect(counts.closed).toBe(1);

  // Untoggling restores the lead to the active funnel.
  await setStageFlags(stage.id, { isWon: false });
  expect((await loadActiveLeadRows()).map((r) => r.id)).toContain(lead.id);
  expect((await loadClosedLeadRows("won")).map((r) => r.id)).toEqual([]);
});

test("entering a stage the owner flagged Won enqueues none of its automations and cancels what was queued — the lead is finished", async () => {
  // A mid-pipeline stage with a drip attached, then promoted to terminal:
  // the flag must win over the attached automation.
  const stage = await stageByName("Video shoot scheduled");
  const followUp = await createTemplate();
  await attachAutomation(stage.id, followUp.id);
  await setStageFlags(stage.id, { isWon: true });

  // The lead sits in the entry stage with a nurture email still queued.
  const nurture = await createTemplate();
  const lead = await createLead();
  await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * 60_000),
  });

  await setLeadStage(lead.id, stage.id);

  const jobs = await jobsForLead(lead.id);
  expect(jobs.map((j) => j.templateId)).not.toContain(followUp.id);
  expect(jobs.filter((j) => j.status === "pending")).toEqual([]);
});

test("a lead in a stage the owner flags Needs-my-action surfaces in the inbox as waiting", async () => {
  const stage = await stageByName("Video shoot scheduled");
  const lead = await createLead({ stageId: stage.id });

  const waitingFor = (events: Awaited<ReturnType<typeof loadInboxEvents>>) =>
    events.filter((e) => e.kind === "waiting" && e.leadId === lead.id);

  expect(waitingFor(await loadInboxEvents())).toHaveLength(0);

  await setStageFlags(stage.id, { needsAction: true });

  const waiting = waitingFor(await loadInboxEvents());
  expect(waiting).toHaveLength(1);
  expect(waiting[0].title).toContain("waiting on you");
});

test("re-pointing the Entry Stage lands subsequent inquiries there and enqueues that stage's automations", async () => {
  const target = await stageByName("Stale");
  const welcome = await createTemplate();
  await attachAutomation(target.id, welcome.id);

  await updatePipelineSettings({ entryStageId: target.id });

  const res = await submitInquiry(
    jsonRequest("/api/lead", {
      firstName: "Rosie",
      lastName: "Larsen",
      email: "rosie@example.com",
      packageInterest: "heirloom",
    }),
  );
  expect(res.status).toBe(200);
  const { leadId } = await res.json();

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  expect(lead.stageId).toBe(target.id);

  const jobs = await jobsForLead(leadId);
  expect(jobs.map((j) => j.templateId)).toEqual([welcome.id]);
  expect(jobs[0].status).toBe("pending");
});

test("re-pointing the Booking Stage makes subsequent bookings promote to it", async () => {
  const target = await stageByName("Call completed");
  const lead = await createLead({ email: "rosie@example.com" });

  await updatePipelineSettings({ bookingStageId: target.id });

  const weekday = new Date(Date.now() + 7 * 86_400_000);
  while (weekday.getUTCDay() === 0 || weekday.getUTCDay() === 6) {
    weekday.setUTCDate(weekday.getUTCDate() + 1);
  }
  const res = await submitBooking(
    jsonRequest("/api/book", {
      firstName: "Rosie",
      lastName: "Larsen",
      email: "rosie@example.com",
      packageInterest: "heirloom",
      date: weekday.toISOString().slice(0, 10),
      time: "9:00 AM",
      consent: true,
    }),
  );
  expect(res.status).toBe(200);

  const [leadAfter] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, lead.id));
  expect(leadAfter.stageId).toBe(target.id);
});

test("the settings pointers refuse to aim at a stage that doesn't exist", async () => {
  const ghost = "00000000-0000-0000-0000-000000000000";

  await expect(
    updatePipelineSettings({ entryStageId: ghost }),
  ).rejects.toThrow("Unknown stage");
  await expect(
    updatePipelineSettings({ bookingStageId: ghost }),
  ).rejects.toThrow("Unknown stage");

  // Both pointers still aim at the seeded stages.
  const { entryStageId, bookingStageId } = await getSettings();
  expect(entryStageId).toBe((await stageByName("New")).id);
  expect(bookingStageId).toBe((await stageByName("Booked a call")).id);
});

test("flag toggling and settings re-pointing require an authenticated session", async () => {
  const [stage] = await listStages();
  resetTestRequestHeaders();

  await expect(setStageFlags(stage.id, { isWon: true })).rejects.toThrow(
    "Unauthorized",
  );
  await expect(
    updatePipelineSettings({ entryStageId: stage.id }),
  ).rejects.toThrow("Unauthorized");
});

test("the owner can change the cold threshold from settings, and cold views follow it", async () => {
  const twelveDaysQuiet = await createLead({
    updatedAt: new Date(Date.now() - 12 * 86_400_000),
  });

  // At the default 14-day threshold the lead is still warm.
  let stuck = await loadStuckLeadRows();
  expect(stuck.map((r) => r.id)).toEqual([]);

  await updatePipelineSettings({ coldThresholdDays: 10 });

  expect((await getSettings()).coldThresholdDays).toBe(10);
  stuck = await loadStuckLeadRows();
  expect(stuck.map((r) => r.id)).toEqual([twelveDaysQuiet.id]);
});

test("the cold threshold refuses zero, negative, and fractional day counts", async () => {
  for (const bad of [0, -3, 2.5]) {
    await expect(
      updatePipelineSettings({ coldThresholdDays: bad }),
    ).rejects.toThrow("whole number of days");
  }
  expect((await getSettings()).coldThresholdDays).toBe(14);
});
