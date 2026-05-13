"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  TemplateEditor,
  type TemplateBody,
} from "@/components/admin/template-editor";
import {
  listActiveTemplatesForComposer,
  sendOneOffEmailToLead,
} from "@/app/admin/actions";

const EMPTY_DOC: TemplateBody = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

type TemplateOption = {
  id: string;
  name: string;
  subject: string;
  body: unknown;
};

export function OneOffComposer({
  leadId,
  leadEmail,
  leadFirstName,
}: {
  leadId: string;
  leadEmail: string;
  leadFirstName: string;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState<TemplateBody>(EMPTY_DOC);
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [pending, startTransition] = useTransition();

  // Lazy-load active templates the first time the dialog opens.
  useEffect(() => {
    if (!open || templates !== null) return;
    listActiveTemplatesForComposer()
      .then((rows) => setTemplates(rows as TemplateOption[]))
      .catch(() => setTemplates([]));
  }, [open, templates]);

  const reset = () => {
    setSubject("");
    setBody(EMPTY_DOC);
  };

  const loadTemplate = (id: string) => {
    if (!id) return;
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    setSubject(tpl.subject);
    setBody(tpl.body as TemplateBody);
  };

  const send = () => {
    startTransition(async () => {
      const result = await sendOneOffEmailToLead({
        leadId,
        subject,
        body,
      });
      if (result.ok) {
        toast.success(`Email sent to ${leadFirstName}`);
        reset();
        setOpen(false);
      } else {
        toast.error(result.error ?? "Failed to send.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="font-heading text-xs uppercase tracking-[0.14em] px-3 py-2 border border-forest/20 text-forest hover:bg-off-white"
        >
          Compose email
        </button>
      </DialogTrigger>
      <DialogContent className="!max-w-3xl gap-0 p-0 overflow-hidden border-t-4 border-gold max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 py-3 border-b border-forest/10">
          <DialogTitle className="font-heading text-forest">
            Compose email to {leadFirstName}
          </DialogTitle>
          <p className="text-xs text-tofino">{leadEmail}</p>
        </DialogHeader>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs font-heading uppercase tracking-[0.14em] text-tofino shrink-0">
              Start from:
            </label>
            <select
              defaultValue=""
              disabled={pending || templates === null}
              onChange={(e) => loadTemplate(e.target.value)}
              className="text-sm px-2 py-1 border border-forest/15 bg-white focus:outline-none focus:border-gold flex-1"
            >
              <option value="">
                {templates === null
                  ? "Loading templates…"
                  : templates.length === 0
                    ? "No active templates"
                    : "Blank"}
              </option>
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-heading uppercase tracking-[0.14em] text-tofino">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              disabled={pending}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-base px-3 py-2 border border-forest/15 bg-white focus:outline-none focus:border-gold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-heading uppercase tracking-[0.14em] text-tofino">
              Body
            </label>
            <TemplateEditor
              key={subject + (templates?.length ?? 0)}
              value={body}
              onChange={setBody}
            />
          </div>
        </div>
        <footer className="px-6 py-3 border-t border-forest/10 bg-off-white/80 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="font-heading text-xs uppercase tracking-[0.14em] px-3 py-2 text-tofino hover:text-forest"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !subject.trim()}
            onClick={send}
            className="font-heading text-xs uppercase tracking-[0.14em] px-4 py-2 bg-forest text-white hover:bg-forest-deep disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
