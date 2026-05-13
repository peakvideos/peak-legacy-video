import "server-only";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { EMAIL_BASE_CSS } from "./email-styles";
import { EMAIL_TIPTAP_EXTENSIONS, type EmailTemplateBody } from "./tiptap-extensions";
import {
  buildVariableMap,
  substituteVariables,
  type LeadVariableInput,
} from "./variables";

function wrapHtml(bodyHtml: string, unsubscribeUrl?: string): string {
  const footer = unsubscribeUrl
    ? `<hr style="border:none;border-top:1px solid #c5c5c5;margin:32px 0 16px;" /><p style="font-size:11px;color:#597B7E;text-align:center;">Don't want these emails? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#597B7E;">Unsubscribe here</a>.</p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${EMAIL_BASE_CSS}</style></head><body><div class="wrap">${bodyHtml}${footer}</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Tiptap's renderToHTMLString accepts either a JSON document or a Prosemirror node. */
function rawBodyHtml(body: EmailTemplateBody): string {
  if (!body || typeof body !== "object") return "";
  return renderToHTMLString({
    extensions: EMAIL_TIPTAP_EXTENSIONS,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: body as any,
  });
}

/**
 * Pulls plain text out of a Tiptap JSON document. Used by the email's
 * text/plain alternate part and by template-body validation.
 */
export function tiptapDocToPlainText(body: EmailTemplateBody): string {
  if (!body || typeof body !== "object") return "";
  const out: string[] = [];
  walk(body as { type?: string; text?: string; content?: unknown[] }, out);
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function walk(
  node: { type?: string; text?: string; content?: unknown[] },
  out: string[],
): void {
  if (!node) return;
  if (typeof node.text === "string") {
    out.push(node.text);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walk(child as { type?: string; text?: string; content?: unknown[] }, out);
    }
  }
  // Block-level nodes get a trailing newline so paragraphs separate.
  if (node.type && BLOCK_TYPES.has(node.type)) {
    out.push("\n");
  }
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "bulletList",
  "orderedList",
  "horizontalRule",
  "codeBlock",
]);

/**
 * Renders an email template body + subject for the given lead, performing
 * variable substitution and HTML wrapping. Pure function — caller decides
 * whether to actually send the result.
 *
 * If `lead.unsubscribeUrl` is provided, an unsubscribe footer is appended
 * automatically. Templates can also use `{{unsubscribeUrl}}` inline.
 */
export function renderTemplate(args: {
  subject: string;
  body: EmailTemplateBody;
  lead: LeadVariableInput;
}): { subject: string; html: string; text: string } {
  const variables = buildVariableMap(args.lead);

  const subject = substituteVariables(args.subject, variables);

  const rawHtml = rawBodyHtml(args.body);
  const substitutedHtml = substituteVariables(rawHtml, variables);
  const html = wrapHtml(substitutedHtml, args.lead.unsubscribeUrl);

  const rawText = tiptapDocToPlainText(args.body);
  const substitutedText = substituteVariables(rawText, variables);
  const text = args.lead.unsubscribeUrl
    ? `${substitutedText}\n\n---\nDon't want these emails? Unsubscribe: ${args.lead.unsubscribeUrl}`
    : substitutedText;

  return { subject, html, text };
}

/** Used by the templates list UI to render a tiny preview without a lead. */
export function renderTemplatePreview(args: {
  subject: string;
  body: EmailTemplateBody;
}): { subject: string; html: string } {
  const rawHtml = rawBodyHtml(args.body);
  const html = wrapHtml(rawHtml);
  return { subject: args.subject, html };
}

export { escapeHtml };
