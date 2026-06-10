import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { POST as submitInquiry } from "@/app/api/lead/route";
import {
  attachAutomation,
  createTemplate,
  jobsForLead,
  jsonRequest,
} from "./helpers/fixtures";

const MINUTE = 60_000;

function inquiry(overrides: Record<string, unknown> = {}) {
  return jsonRequest("/api/lead", {
    firstName: "Rosie",
    lastName: "Larsen",
    email: "rosie@example.com",
    packageInterest: "legacy",
    ...overrides,
  });
}

test("a new inquiry lands in the new stage and enqueues that stage's automations", async () => {
  const welcome = await createTemplate();
  const followUp = await createTemplate();
  await attachAutomation("new", welcome.id, { delayMinutes: 5, position: 0 });
  await attachAutomation("new", followUp.id, {
    delayMinutes: 60 * 24,
    position: 1,
  });

  const before = Date.now();
  const res = await submitInquiry(inquiry({ email: "Rosie@Example.com" }));

  expect(res.status).toBe(200);
  const payload = await res.json();
  expect(payload.ok).toBe(true);

  const allLeads = await db.select().from(leads);
  expect(allLeads).toHaveLength(1);
  const lead = allLeads[0];
  expect(lead.id).toBe(payload.leadId);
  expect(lead.stage).toBe("new");
  expect(lead.email).toBe("rosie@example.com"); // stored lowercased

  const jobs = await jobsForLead(lead.id);
  expect(jobs).toHaveLength(2);
  expect(jobs.map((j) => j.status)).toEqual(["pending", "pending"]);
  expect(jobs.map((j) => j.templateId)).toEqual([welcome.id, followUp.id]);

  // Delays are anchored to submission time.
  const after = Date.now();
  expect(jobs[0].sendAt.getTime()).toBeGreaterThanOrEqual(before + 5 * MINUTE);
  expect(jobs[0].sendAt.getTime()).toBeLessThanOrEqual(after + 5 * MINUTE);
  expect(jobs[1].sendAt.getTime()).toBeGreaterThanOrEqual(
    before + 24 * 60 * MINUTE,
  );
});
