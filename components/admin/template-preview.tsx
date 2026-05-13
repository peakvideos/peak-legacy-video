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
    <div className="border border-forest/15 bg-white">
      <div className="border-b border-forest/10 px-4 py-2 bg-off-white/60">
        <p className="font-heading text-[0.7rem] uppercase tracking-[0.14em] text-tofino mb-1">
          Subject
        </p>
        <p className="text-sm text-forest font-heading truncate">
          {renderedSubject || (
            <span className="italic text-tofino/60">No subject set</span>
          )}
        </p>
      </div>
      <div className="px-4 py-3 bg-off-white/30">
        <p className="font-heading text-[0.7rem] uppercase tracking-[0.14em] text-tofino mb-2">
          Body preview · sample variables
        </p>
        <div className="bg-white border border-forest/8 max-h-[420px] overflow-auto">
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
