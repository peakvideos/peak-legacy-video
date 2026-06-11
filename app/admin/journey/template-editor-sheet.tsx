"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  TemplateEditor,
  type TemplateBody,
} from "@/components/admin/template-editor";
import { TemplatePreview } from "@/components/admin/template-preview";
import { useAutosave, type AutosaveStatus } from "@/lib/use-autosave";
import {
  archiveTemplate,
  getTemplateForEditor,
  sendTestTemplateEmail,
  updateTemplateContent,
} from "./actions";

type LoadedTemplate = {
  id: string;
  name: string;
  subject: string;
  body: TemplateBody;
};

const TemplateEditorContext = createContext<{
  openTemplate: (id: string) => void;
} | null>(null);

/** Any journey card or shelf entry opens the slide-over through this. */
export function useTemplateEditor() {
  const ctx = useContext(TemplateEditorContext);
  if (!ctx) {
    throw new Error(
      "useTemplateEditor must be used inside TemplateEditorProvider",
    );
  }
  return ctx;
}

/**
 * Owns the single slide-over editor for the journey: templates are edited
 * where they are used, so every card and shelf entry funnels into this one
 * sheet instead of navigating to a separate page.
 */
export function TemplateEditorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [template, setTemplate] = useState<LoadedTemplate | null>(null);
  // Guards against a slow load landing after the sheet was closed or
  // another template was opened.
  const requestRef = useRef(0);

  const openTemplate = useCallback((id: string) => {
    const seq = ++requestRef.current;
    setOpenId(id);
    setTemplate(null);
    getTemplateForEditor(id)
      .then((t) => {
        if (requestRef.current === seq) setTemplate(t as LoadedTemplate);
      })
      .catch((err) => {
        if (requestRef.current !== seq) return;
        setOpenId(null);
        toast.error(
          err instanceof Error ? err.message : "Failed to open template.",
        );
      });
  }, []);

  const close = useCallback(() => {
    requestRef.current += 1;
    setOpenId(null);
    setTemplate(null);
  }, []);

  const value = useMemo(() => ({ openTemplate }), [openTemplate]);

  return (
    <TemplateEditorContext.Provider value={value}>
      {children}
      <Sheet
        open={openId != null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent className="bg-(--adm-surface-2) border-(--adm-border) sm:max-w-[880px]">
          {template ? (
            <TemplateSheetForm
              key={template.id}
              template={template}
              onClose={close}
            />
          ) : (
            <>
              <SheetHeader>
                <div>
                  <SheetTitle className="text-(--adm-text)">
                    Edit template
                  </SheetTitle>
                  <SheetDescription>Loading…</SheetDescription>
                </div>
              </SheetHeader>
              <SheetBody />
            </>
          )}
        </SheetContent>
      </Sheet>
    </TemplateEditorContext.Provider>
  );
}

/** A shelf entry: an active template no stage sends, click to edit. */
export function UnattachedTemplateCard({
  template,
}: {
  template: { id: string; name: string; subject: string };
}) {
  const { openTemplate } = useTemplateEditor();
  return (
    <button
      type="button"
      onClick={() => openTemplate(template.id)}
      className="block w-[260px] text-left bg-(--adm-surface) border border-(--adm-border) px-3 py-2.5 hover:border-gold"
    >
      <p className="text-sm text-(--adm-text) truncate">{template.name}</p>
      <p className="text-xs text-(--adm-text-muted) truncate">
        {template.subject}
      </p>
    </button>
  );
}

type Snapshot = {
  subject: string;
  body: TemplateBody;
};

function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  return (
    a.subject === b.subject &&
    JSON.stringify(a.body) === JSON.stringify(b.body)
  );
}

function TemplateSheetForm({
  template,
  onClose,
}: {
  template: LoadedTemplate;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState<TemplateBody>(template.body);
  const [bodyHtml, setBodyHtml] = useState<string>("");

  const initialSnapshot = useMemo<Snapshot>(
    () => ({ subject: template.subject, body: template.body }),
    [template],
  );
  const currentSnapshot = useMemo<Snapshot>(
    () => ({ subject, body }),
    [subject, body],
  );

  const save = useCallback(
    async (snapshot: Snapshot) => {
      await updateTemplateContent({
        id: template.id,
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

  // Send-test should reflect what's stored — wait for autosave to settle.
  const canSendTest = !dirty && status !== "saving";

  return (
    <>
      <SheetHeader className="pr-12">
        <div className="flex-1 min-w-0">
          <SheetTitle className="text-(--adm-text) truncate">
            {template.name}
          </SheetTitle>
          <SheetDescription>
            Edits save automatically and apply to queued sends.
          </SheetDescription>
        </div>
        <ConfirmDialog
          title="Archive template?"
          description={`"${template.name}" will leave every picker and the Unattached shelf, and any pending sends of it will be cancelled.`}
          confirmLabel="Archive"
          destructive
          onConfirm={async () => {
            await archiveTemplate(template.id);
            toast.success("Template archived — pending sends cancelled");
            onClose();
          }}
          trigger={
            <button
              type="button"
              className="text-xs font-heading uppercase tracking-[0.14em] px-3 py-2 border border-blush/40 text-blush hover:bg-blush/5 shrink-0"
            >
              Archive
            </button>
          }
        />
      </SheetHeader>

      <SheetBody className="space-y-5">
        <section className="space-y-2">
          <label className="text-xs font-heading uppercase tracking-[0.14em] text-(--adm-text-muted)">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => {
              if (dirty) void flushNow();
            }}
            placeholder="Subject — {{firstName}} works here"
            className="w-full text-base px-3 py-2 border border-(--adm-border) bg-(--adm-surface) text-(--adm-text) focus:outline-none focus:border-gold"
          />
        </section>

        <section className="space-y-2">
          <label className="text-xs font-heading uppercase tracking-[0.14em] text-(--adm-text-muted)">
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
      </SheetBody>

      <footer className="border-t border-(--adm-border) px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <SendTestButton templateId={template.id} canSend={canSendTest} />
        <AutosaveStatusIndicator
          status={status}
          dirty={dirty}
          savedAt={savedAt}
          error={error}
          onRetry={() => void flushNow()}
        />
      </footer>
    </>
  );
}

function SendTestButton({
  templateId,
  canSend,
}: {
  templateId: string;
  canSend: boolean;
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
        !canSend
          ? "Wait for autosave to finish before sending a test."
          : "Send a test email to your address with sample variables."
      }
      className="font-heading text-xs uppercase tracking-[0.14em] px-4 py-2 border border-(--adm-border-strong) text-(--adm-text) hover:bg-(--adm-hover) disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
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
          className="font-heading uppercase tracking-[0.1em] text-gold hover:text-(--adm-text)"
        >
          Retry
        </button>
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-(--adm-text-muted)">
        <Spinner /> Saving…
      </span>
    );
  }
  if (status === "editing" || dirty) {
    return (
      <span className="text-xs text-(--adm-text-muted) opacity-70">
        Editing…
      </span>
    );
  }
  if (status === "saved" && savedAt) {
    return (
      <span className="flex items-center gap-1 text-xs text-(--adm-text-muted)">
        <CheckIcon /> Saved {timeFmt.format(savedAt)}
      </span>
    );
  }
  return (
    <span className="text-xs text-(--adm-text-muted) opacity-60">Saved</span>
  );
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
      <path
        d="M2.5 6.2 5 8.6 9.7 3.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const timeFmt = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});
