import "server-only";

export type BookingTemplateInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  packageLabel: string;
  notes?: string | null;
  /** "Tuesday, April 28, 2026" */
  dateLabel: string;
  /** "10:00 AM" */
  timeLabel: string;
  /** Google Meet URL for the call, when the calendar event was created. */
  meetLink?: string | null;
};

const ownerName = "The Peak Studios CO Team";

const baseStyle = `
  body { font-family: 'Cardo', Georgia, serif; color: #1a1a1a; line-height: 1.7; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
  .h { font-family: 'Alata', sans-serif; color: #233415; font-size: 22px; margin: 0 0 16px; }
  .muted { color: #597B7E; font-style: italic; }
  .row { margin: 4px 0; }
  .label { font-weight: 700; color: #233415; }
`.replace(/\s+/g, " ");

export function leadConfirmationTemplate(input: BookingTemplateInput) {
  const subject = `You're booked in — Peak Studios CO`;
  const formatText = input.meetLink
    ? `Where: Google Meet — ${input.meetLink}\n\nYou'll also find this link in the calendar invite we just sent you.`
    : `Format: Phone or video call — we'll follow up with details`;
  const text = `Hi ${input.firstName},

You're all set! Here are your booking details:

Date: ${input.dateLabel}
Time: ${input.timeLabel} Pacific Time
${formatText}

We're looking forward to chatting with you. If you need to reschedule, just reply to this email.

See you soon,
${ownerName}
Peak Studios CO`;

  const formatHtml = input.meetLink
    ? `<p class="row"><span class="label">Where:</span> Google Meet — <a href="${escapeHtml(input.meetLink)}">${escapeHtml(input.meetLink)}</a></p>
    <p class="muted">You'll also find this link in the calendar invite we just sent you.</p>`
    : `<p class="row"><span class="label">Format:</span> Phone or video call — we'll follow up with details</p>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body><div class="wrap">
    <p>Hi ${escapeHtml(input.firstName)},</p>
    <p>You're all set! Here are your booking details:</p>
    <p class="row"><span class="label">Date:</span> ${escapeHtml(input.dateLabel)}</p>
    <p class="row"><span class="label">Time:</span> ${escapeHtml(input.timeLabel)} Pacific Time</p>
    ${formatHtml}
    <p>We're looking forward to chatting with you. If you need to reschedule, just reply to this email.</p>
    <p>See you soon,<br/>${escapeHtml(ownerName)}<br/>Peak Studios CO</p>
  </div></body></html>`;

  return { subject, text, html };
}

export function ownerNotificationTemplate(input: BookingTemplateInput) {
  const subject = `New booking — ${input.firstName} ${input.lastName}`;
  const text = `New discovery call booked!

Name: ${input.firstName} ${input.lastName}
Email: ${input.email}
Phone: ${input.phone || "—"}
Date/Time: ${input.dateLabel} at ${input.timeLabel}
Package interest: ${input.packageLabel}
Notes: ${input.notes || "—"}${input.meetLink ? `\nGoogle Meet: ${input.meetLink}` : ""}

This has been added to your Google Calendar.`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body><div class="wrap">
    <h1 class="h">New discovery call booked!</h1>
    <p class="row"><span class="label">Name:</span> ${escapeHtml(input.firstName)} ${escapeHtml(input.lastName)}</p>
    <p class="row"><span class="label">Email:</span> ${escapeHtml(input.email)}</p>
    <p class="row"><span class="label">Phone:</span> ${escapeHtml(input.phone || "—")}</p>
    <p class="row"><span class="label">Date/Time:</span> ${escapeHtml(input.dateLabel)} at ${escapeHtml(input.timeLabel)} PT</p>
    <p class="row"><span class="label">Package interest:</span> ${escapeHtml(input.packageLabel)}</p>
    <p class="row"><span class="label">Notes:</span> ${escapeHtml(input.notes || "—")}</p>
    ${input.meetLink ? `<p class="row"><span class="label">Google Meet:</span> <a href="${escapeHtml(input.meetLink)}">${escapeHtml(input.meetLink)}</a></p>` : ""}
    <p class="muted">This has been added to your Google Calendar.</p>
  </div></body></html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
