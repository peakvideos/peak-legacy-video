"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { TemplateEditor, type TemplateBody } from "@/components/admin/template-editor";
import { TemplatePreview } from "@/components/admin/template-preview";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { TEMPLATE_VARIABLES } from "@/lib/email/variables";
import { useAutosave, type AutosaveStatus } from "@/lib/use-autosave";
import {
  archiveTemplate,
  sendTestTemplateEmail,
  unarchiveTemplate,
  updateTemplate,
} from "../actions";

type Snapshot = {
  name: string;
  slug: string;
  subject: string;
  body: TemplateBody;
};

function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  return (
    a.name === b.name &&
    a.slug === b.slug &&
    a.subject === b.subject &&
    JSON.stringify(a.body) === JSON.stringify(b.body)
  );
}

export function TemplateEditForm({
  template,
}: {
  template: {
    id: string;
    name: string;
    slug: string;
    subject: string;
    body: TemplateBody;
    archivedAt: Date | null;
  };
}) {
  const [name, setName] = useState(template.name);
  const [slug, setSlug] = useState(template.slug);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState<TemplateBody>(template.body);
  const [bodyHtml, setBodyHtml] = useState<string>("");
  const [archivePending, startArchiveTransition] = useTransition();

  const initialSnapshot = useMemo<Snapshot>(
    () => ({
      name: template.name,
      slug: template.slug,
      subject: template.subject,
      body: template.body,
    }),
    [template.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const currentSnapshot = useMemo<Snapshot>(
    () => ({ name, slug, subject, body }),
    [name, slug, subject, body],
  );

  const save = useCallback(
    async (snapshot: Snapshot) => {
      await updateTemplate({
        id: template.id,
        name: snapshot.name,
        slug: snapshot.slug,
        subject: snapshot.subject,
        body: snapshot.body,
      });
    },
    [template.id],
  );

  const { status, savedAt, error, flushNow, dirty } = useAutosave({
    value: currentSnapshot,
    initialValue: initialSnapshot,
    save,
    isEqual: snapshotsEqual,
  });

  const archived = !!template.archivedAt;
  // Send-test should be enabled only when the saved version on the server
  // matches what's on screen — i.e. not dirty AND not actively saving.
  const canSendTest = !archived && !dirty && status !== "saving";

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (dirty) void flushNow();
            }}
            placeholder="Template name"
            className="w-full text-3xl text-forest bg-transparent border-b border-transparent focus:border-gold focus:outline-none"
          />
          <div className="flex items-center gap-2 mt-1">
            <span className="text-tofino text-xs">slug:</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={() => {
                if (dirty) void flushNow();
              }}
              className="text-xs font-heading uppercase tracking-[0.1em] text-tofino bg-transparent border-b border-transparent focus:border-gold focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {archived ? (
            <button
              type="button"
              disabled={archivePending}
              onClick={() => {
                startArchiveTransition(async () => {
                  await unarchiveTemplate(template.id);
                  toast.success("Template unarchived");
                });
              }}
              className="text-xs font-heading uppercase tracking-[0.14em] px-3 py-2 border border-forest/20 text-forest hover:bg-off-white disabled:opacity-50"
            >
              Unarchive
            </button>
          ) : (
            <ConfirmDialog
              title="Archive template?"
              description="It will be removed from all stage automations and any pending sends will be cancelled."
              confirmLabel="Archive"
              destructive
              onConfirm={async () => {
                await archiveTemplate(template.id);
                toast.success("Template archived");
              }}
              trigger={
                <button
                  type="button"
                  className="text-xs font-heading uppercase tracking-[0.14em] px-3 py-2 border border-blush/40 text-blush hover:bg-blush/5"
                >
                  Archive
                </button>
              }
            />
          )}
        </div>
      </header>

      <section className="space-y-2">
        <label className="text-xs font-heading uppercase tracking-[0.14em] text-tofino">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onBlur={() => {
            if (dirty) void flushNow();
          }}
          className="w-full text-base px-3 py-2 border border-forest/15 bg-white focus:outline-none focus:border-gold"
        />
      </section>

      <section className="space-y-2">
        <label className="text-xs font-heading uppercase tracking-[0.14em] text-tofino">
          Body
        </label>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TemplateEditor
            value={body}
            onChange={setBody}
            onHtmlChange={setBodyHtml}
          />
          <TemplatePreview subject={subject} bodyHtml={bodyHtml} />
        </div>
      </section>

      <section className="bg-off-white/60 border border-forest/10 p-4">
        <p className="text-xs font-heading uppercase tracking-[0.14em] text-tofino mb-2">
          Available variables
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {TEMPLATE_VARIABLES.map((v) => (
            <li key={v.name} className="text-tofino">
              <span className="font-heading text-forest">{`{{${v.name}}}`}</span>{" "}
              · {v.description}
            </li>
          ))}
        </ul>
      </section>

      <footer className="sticky bottom-0 bg-off-white/90 backdrop-blur border-t border-forest/10 py-3 -mx-6 px-6 flex items-center justify-between gap-3 flex-wrap">
        <SendTestButton templateId={template.id} canSend={canSendTest} archived={archived} />
        <AutosaveStatusIndicator
          status={status}
          dirty={dirty}
          savedAt={savedAt}
          error={error}
          onRetry={() => void flushNow()}
        />
      </footer>
    </div>
  );
}

function SendTestButton({
  templateId,
  canSend,
  archived,
}: {
  templateId: string;
  canSend: boolean;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const send = () => {
    startTransition(async () => {
      const result = await sendTestTemplateEmail(templateId);
      if (result.ok) {
        toast.success(`Test email sent to ${result.to}`);
      } else {
        toast.error(result.error ?? "Failed to send test email");
      }
    });
  };

  return (
    <button
      type="button"
      disabled={pending || !canSend}
      onClick={send}
      title={
        archived
          ? "Unarchive the template before sending a test."
          : !canSend
            ? "Wait for autosave to finish before sending a test."
            : "Send a test email to your address with sample variables."
      }
      className="font-heading text-xs uppercase tracking-[0.14em] px-4 py-2 border border-forest/20 text-forest hover:bg-off-white disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
    >
      {pending ? (
        <>
          <Spinner />
          Sending…
        </>
      ) : (
        "Send test"
      )}
    </button>
  );
}

function AutosaveStatusIndicator({
  status,
  dirty,
  savedAt,
  error,
  onRetry,
}: {
  status: AutosaveStatus;
  dirty: boolean;
  savedAt: Date | null;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-blush" title={error ?? undefined}>
          Save failed{error ? ` — ${error}` : ""}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="font-heading uppercase tracking-[0.1em] text-gold hover:text-forest"
        >
          Retry
        </button>
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-tofino italic">
        <Spinner /> Saving…
      </span>
    );
  }
  if (status === "editing" || dirty) {
    return <span className="text-xs italic text-tofino/70">Editing…</span>;
  }
  if (status === "saved" && savedAt) {
    return (
      <span className="flex items-center gap-1 text-xs italic text-forest/70">
        <CheckIcon /> Saved {timeFmt.format(savedAt)}
      </span>
    );
  }
  return <span className="text-xs italic text-tofino/60">Saved</span>;
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 border-2 border-current/30 border-t-current rounded-full animate-spin"
    />
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M2.5 6.2 5 8.6 9.7 3.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const timeFmt = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});
