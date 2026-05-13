import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import {
  leadConfirmationTemplate,
  ownerNotificationTemplate,
  type BookingTemplateInput,
} from "./templates";
import { renderTemplate } from "./template-render";
import type { EmailTemplateBody } from "./tiptap-extensions";
import type { LeadVariableInput } from "./variables";

/**
 * Gmail SMTP transport. Configured via env:
 *   - GMAIL_SMTP_USER       — the gmail address sending the mail
 *   - GMAIL_SMTP_PASSWORD   — a Gmail App Password (16 chars, no spaces)
 *   - EMAIL_FROM            — display name + address, e.g.
 *                             `Peak Studios CO <peaklegacyvideos@gmail.com>`
 *
 * Personal Gmail allows ~500 sends/day. Sufficient for the nurture volume
 * we expect from a small business.
 */

export function isEmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_SMTP_USER &&
    process.env.GMAIL_SMTP_PASSWORD &&
    process.env.EMAIL_FROM
  );
}

let cached: Transporter | null = null;
function client(): Transporter {
  if (cached) return cached;
  if (!process.env.GMAIL_SMTP_USER || !process.env.GMAIL_SMTP_PASSWORD) {
    throw new Error("GMAIL_SMTP_USER / GMAIL_SMTP_PASSWORD are not set.");
  }
  cached = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_SMTP_USER,
      pass: process.env.GMAIL_SMTP_PASSWORD,
    },
  });
  return cached;
}

type SendResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

async function send(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!isEmailConfigured()) {
    console.warn(
      `[email] Skipped send to ${args.to} — Gmail SMTP not configured (GMAIL_SMTP_USER / GMAIL_SMTP_PASSWORD / EMAIL_FROM missing).`,
    );
    return { ok: false, error: "Gmail SMTP not configured" };
  }
  try {
    const info = await client().sendMail({
      from: process.env.EMAIL_FROM!,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    console.error("[email] Gmail SMTP threw", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function sendBookingLeadConfirmation(
  input: BookingTemplateInput,
): Promise<SendResult> {
  const tpl = leadConfirmationTemplate(input);
  return send({
    to: input.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: process.env.OWNER_NOTIFICATION_EMAIL,
  });
}

export async function sendBookingOwnerNotification(
  input: BookingTemplateInput,
): Promise<SendResult> {
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
  if (!ownerEmail) {
    console.warn("[email] OWNER_NOTIFICATION_EMAIL not set — skipping owner notification.");
    return { ok: false, error: "OWNER_NOTIFICATION_EMAIL not set" };
  }
  const tpl = ownerNotificationTemplate(input);
  return send({
    to: ownerEmail,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: input.email,
  });
}

/**
 * Renders a stored email template against a lead's data and sends it. Used
 * by the cron worker for stage-driven automations.
 */
export async function sendStoredTemplateEmail(args: {
  template: { subject: string; body: EmailTemplateBody };
  to: string;
  lead: LeadVariableInput;
}): Promise<SendResult> {
  const rendered = renderTemplate({
    subject: args.template.subject,
    body: args.template.body,
    lead: args.lead,
  });
  return send({
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: process.env.OWNER_NOTIFICATION_EMAIL,
  });
}
