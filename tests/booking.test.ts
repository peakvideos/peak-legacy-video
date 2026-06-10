import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { bookings, leads } from "@/lib/db/schema";
import { POST as submitBooking } from "@/app/api/book/route";
import { POST as submitInquiry } from "@/app/api/lead/route";
import { smtp } from "./stubs/nodemailer";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  jobsForLead,
  jsonRequest,
} from "./helpers/fixtures";

/** A weekday roughly a week out — always bookable per the route's rules. */
function nextWeekdayIso(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function booking(overrides: Record<string, unknown> = {}) {
  return jsonRequest("/api/book", {
    firstName: "Rosie",
    lastName: "Larsen",
    email: "rosie@example.com",
    packageInterest: "heirloom",
    date: nextWeekdayIso(),
    time: "9:00 AM",
    consent: true,
    ...overrides,
  });
}

test("a first-time visitor who books lands in booked_a_call with a scheduled booking, automations, and both confirmation emails", async () => {
  const confirmation = await createTemplate();
  await attachAutomation("booked_a_call", confirmation.id, { delayMinutes: 10 });

  const res = await submitBooking(booking());

  expect(res.status).toBe(200);
  const payload = await res.json();
  expect(payload.ok).toBe(true);

  const [lead] = await db.select().from(leads);
  expect(lead.id).toBe(payload.leadId);
  expect(lead.stage).toBe("booked_a_call");

  const allBookings = await db.select().from(bookings);
  expect(allBookings).toHaveLength(1);
  expect(allBookings[0].id).toBe(payload.bookingId);
  expect(allBookings[0].leadId).toBe(lead.id);
  expect(allBookings[0].status).toBe("scheduled");
  // The 9:00 AM slot is Pacific time, stored as UTC.
  const ptHour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).format(allBookings[0].scheduledAt);
  expect(ptHour).toBe("09");

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].templateId).toBe(confirmation.id);
  expect(jobs[0].status).toBe("pending");

  // Transactional emails: confirmation to the lead, notification to the owner.
  expect(smtp.sent.map((m) => m.to).sort()).toEqual([
    "owner-inbox@test.local",
    "rosie@example.com",
  ]);
});

test("booking promotes a lead from new to booked_a_call and swaps the queued drip for the booked automations", async () => {
  const nurture = await createTemplate();
  const callPrep = await createTemplate();
  await attachAutomation("new", nurture.id, { delayMinutes: 60 });
  await attachAutomation("booked_a_call", callPrep.id, { delayMinutes: 10 });

  await submitInquiry(
    jsonRequest("/api/lead", {
      firstName: "Rosie",
      lastName: "Larsen",
      email: "rosie@example.com",
      packageInterest: "heirloom",
    }),
  );
  const [lead] = await db.select().from(leads);
  expect(lead.stage).toBe("new");

  const res = await submitBooking(booking());
  expect(res.status).toBe(200);

  const [promoted] = await db.select().from(leads);
  expect(promoted.id).toBe(lead.id);
  expect(promoted.stage).toBe("booked_a_call");

  const jobs = await jobsForLead(lead.id);
  expect(jobs.map((j) => [j.templateId, j.status]).sort()).toEqual(
    [
      [nurture.id, "cancelled"],
      [callPrep.id, "pending"],
    ].sort(),
  );
});

test("booking again from further down the funnel never demotes the lead and leaves their queue alone", async () => {
  const shootPrep = await createTemplate();
  const lead = await createLead({
    email: "rosie@example.com",
    stage: "call_completed",
  });
  await attachAutomation("call_completed", shootPrep.id);
  const existing = await createEmailJob(lead.id, shootPrep.id, {
    sendAt: new Date(Date.now() + 3_600_000),
  });

  const res = await submitBooking(booking());
  expect(res.status).toBe(200);

  const [after] = await db.select().from(leads);
  expect(after.stage).toBe("call_completed");

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].id).toBe(existing.id);
  expect(jobs[0].status).toBe("pending");
});

test("a slot that was just taken returns 409 and records nothing for the second visitor", async () => {
  const res1 = await submitBooking(booking());
  expect(res1.status).toBe(200);

  const res2 = await submitBooking(
    booking({ firstName: "Stan", email: "stan@example.com" }),
  );
  expect(res2.status).toBe(409);
  expect((await res2.json()).error).toMatch(/just booked/i);

  expect(await db.select().from(bookings)).toHaveLength(1);
  const allLeads = await db.select().from(leads);
  expect(allLeads).toHaveLength(1);
  expect(allLeads[0].email).toBe("rosie@example.com");
});
