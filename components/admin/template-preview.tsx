"use client";

import { useMemo } from "react";
import { EMAIL_BASE_CSS } from "@/lib/email/email-styles";
import {
  buildVariableMap,
  substituteVariables,
} from "@/lib/email/variables";

const SAMPLE_LEAD = {
  firstName: "Sarah",
  lastName: "Chen",
  email: "sarah.chen@example.com",
  packageInterest: "legacy" as const,
  bookingUrl: "https://peakstudios.example/book",
};

/**
 * Live preview of an email template. Takes the HTML emitted by the Tiptap
 * editor and substitutes every `{{variable}}` with sample data so the
 * author sees what the email will actually look like.
 *
 * Variable substitution is identical to the server-side renderer (same
 * `substituteVariables` function); only the sample lead values differ.
 */
export function TemplatePreview({
  subject,
  bodyHtml,
}: {
  subject: string;
  bodyHtml: string;
}) {
  const variables = useMemo(() => buildVariableMap(SAMPLE_LEAD), []);
  const renderedSubject = useMemo(
    () => substituteVariables(subject, variables),
    [subject, variables],
  );
  const renderedBody = useMemo(
    () => substituteVariables(bodyHtml, variables),
    [bodyHtml, variables],
  );

  return (
    <div className="border border-(--adm-border) bg-(--adm-surface)">
      <div className="border-b border-(--adm-border) px-4 py-2 bg-(--adm-surface-2)">
        <p className="font-heading text-[0.7rem] uppercase tracking-[0.14em] text-(--adm-text-muted) mb-1">
          Subject
        </p>
        <p className="text-sm text-(--adm-text) font-heading truncate">
          {renderedSubject || (
            <span className="text-(--adm-text-muted) opacity-60">No subject set</span>
          )}
        </p>
      </div>
      <div className="px-4 py-3 bg-(--adm-surface-2)/50">
        <p className="font-heading text-[0.7rem] uppercase tracking-[0.14em] text-(--adm-text-muted) mb-2">
          Body preview · sample variables
        </p>
        <div className="bg-white border border-(--adm-border) max-h-[420px] overflow-auto">
          <style>{`.email-preview-shell { all: initial; } .email-preview-shell * { font-family: inherit; } ${EMAIL_BASE_CSS}`}</style>
          <div
            className="email-preview-shell"
            dangerouslySetInnerHTML={{ __html: `<div class="wrap">${renderedBody}</div>` }}
          />
        </div>
      </div>
    </div>
  );
}
