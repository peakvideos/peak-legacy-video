import { beforeEach, expect, test } from "vitest";
import { sendOneOffEmailToLead } from "@/app/admin/actions";
import { smtp } from "./stubs/nodemailer";
import { signInAsOwner } from "./helpers/auth";
import { createLead, jobsForLead, tiptapDoc } from "./helpers/fixtures";

beforeEach(async () => {
  await signInAsOwner();
});

test("a one-off email is rendered with the lead's variables and sent without touching the email queue", async () => {
  const lead = await createLead({
    firstName: "Rosie",
    email: "rosie@example.com",
  });

  const result = await sendOneOffEmailToLead({
    leadId: lead.id,
    subject: "Quick note for {{firstName}}",
    body: tiptapDoc("Hi {{firstName}}, just checking in."),
  });

  expect(result).toEqual({ ok: true, to: "rosie@example.com" });
  expect(smtp.sent).toHaveLength(1);
  expect(smtp.sent[0].subject).toBe("Quick note for Rosie");
  expect(smtp.sent[0].html).toContain("Hi Rosie, just checking in.");

  // One-offs are not recorded as jobs — the Gmail Sent folder is the audit trail.
  expect(await jobsForLead(lead.id)).toHaveLength(0);
});

test("a one-off email to an unsubscribed lead is refused", async () => {
  const lead = await createLead({ unsubscribedAt: new Date() });

  const result = await sendOneOffEmailToLead({
    leadId: lead.id,
    subject: "Hello again",
    body: tiptapDoc("Hi."),
  });

  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/unsubscribed/i);
  expect(smtp.sent).toHaveLength(0);
});

test("a one-off email requires a subject", async () => {
  const lead = await createLead();

  const result = await sendOneOffEmailToLead({
    leadId: lead.id,
    subject: "   ",
    body: tiptapDoc("Hi."),
  });

  expect(result.ok).toBe(false);
  expect(smtp.sent).toHaveLength(0);
});
