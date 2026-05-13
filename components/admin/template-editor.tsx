"use client";

import { useEditor, EditorContent, type Content, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  TEMPLATE_VARIABLES,
  lintVariablesInText,
  type VariableValidationIssue,
} from "@/lib/email/variables";

export type TemplateBody = unknown;

const EMPTY_DOC: TemplateBody = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function TemplateEditor({
  value,
  onChange,
  onHtmlChange,
}: {
  value: TemplateBody | null;
  onChange: (next: TemplateBody) => void;
  /** Optional callback firing after every keystroke with the editor's HTML
   * output. Used by the live preview pane. */
  onHtmlChange?: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer" },
        },
      }),
    ],
    content: (value ?? EMPTY_DOC) as Content,
    editorProps: {
      attributes: {
        class:
          "tiptap-editor prose prose-sm max-w-none focus:outline-none min-h-[260px] p-4",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
      if (onHtmlChange) onHtmlChange(editor.getHTML());
    },
    onCreate: ({ editor }) => {
      if (onHtmlChange) onHtmlChange(editor.getHTML());
    },
  });

  if (!editor) {
    return (
      <div className="border border-(--adm-border) bg-(--adm-surface) p-4 text-sm text-(--adm-text-muted)">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="border border-(--adm-border) bg-(--adm-surface) text-(--adm-text)">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <ValidationStrip editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-(--adm-border) px-2 py-1.5 bg-(--adm-surface-2)">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        label="Heading"
      >
        <span className="font-heading text-xs">H</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
      >
        •
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Numbered list"
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Quote"
      >
        ❝
      </ToolbarButton>
      <Divider />
      <LinkButton editor={editor} open={linkOpen} setOpen={setLinkOpen} />
      <Divider />
      <VariablePicker editor={editor} />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "h-7 min-w-7 px-2 text-xs flex items-center justify-center rounded-sm",
        "text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)",
        active && "bg-gold/15 text-gold",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-(--adm-border)" />;
}

function LinkButton({
  editor,
  open,
  setOpen,
}: {
  editor: Editor;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <div className="relative">
      <ToolbarButton
        onClick={() => setOpen(!open)}
        active={editor.isActive("link") || open}
        label="Link"
      >
        🔗
      </ToolbarButton>
      {open && (
        <LinkPopover
          editor={editor}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function LinkPopover({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const existingHref = editor.getAttributes("link").href ?? "";
  const [href, setHref] = useState<string>(existingHref);

  const apply = () => {
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    onClose();
  };

  return (
    <div className="absolute left-0 top-9 z-10 w-72 bg-(--adm-surface) border border-(--adm-border) shadow-md p-2 flex gap-1">
      <input
        autoFocus
        type="text"
        value={href}
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
        placeholder="https://… or {{bookingUrl}}"
        className="flex-1 text-sm px-2 py-1 bg-(--adm-surface) text-(--adm-text) border border-(--adm-border) focus:outline-none focus:border-gold"
      />
      <button
        type="button"
        onClick={apply}
        className="text-xs font-heading uppercase tracking-wider px-2 py-1 bg-forest text-white hover:bg-forest-deep"
      >
        Save
      </button>
    </div>
  );
}

function VariablePicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  const insert = (name: string) => {
    editor.chain().focus().insertContent(`{{${name}}}`).run();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "h-7 px-2.5 text-xs font-heading uppercase tracking-[0.1em] flex items-center gap-1 rounded-sm",
          "text-(--adm-text) hover:bg-gold/15",
          open && "bg-gold/15",
        )}
      >
        {"{{ }}"} <span>variable</span>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-10 w-72 bg-(--adm-surface) border border-(--adm-border) shadow-md py-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => insert(v.name)}
              className="w-full text-left px-3 py-1.5 hover:bg-(--adm-hover)"
            >
              <p className="text-sm font-mono text-(--adm-text)">
                {`{{${v.name}}}`}
              </p>
              <p className="text-xs text-(--adm-text-muted)">{v.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ValidationStrip({ editor }: { editor: Editor }) {
  const text = editor.getText({ blockSeparator: " " });
  const issues = useMemo(() => dedupe(lintVariablesInText(text)), [text]);

  if (issues.length === 0) return null;

  return (
    <div className="border-t border-blush/40 bg-blush/10 px-3 py-1.5 text-xs text-blush flex flex-col gap-0.5">
      {issues.map((issue, i) => (
        <span key={i}>{issueLabel(issue)}</span>
      ))}
    </div>
  );
}

function dedupe(issues: VariableValidationIssue[]): VariableValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key =
      issue.kind === "unknown"
        ? `unknown:${issue.name}`
        : `stray:${issue.brace}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function issueLabel(issue: VariableValidationIssue): string {
  if (issue.kind === "unknown") {
    return `Unknown variable {{${issue.name}}}. Will be sent as literal text.`;
  }
  return `Stray "${issue.brace}" detected — did you mean a variable like {{firstName}}?`;
}
