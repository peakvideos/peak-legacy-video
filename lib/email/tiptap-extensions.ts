/**
 * Shared Tiptap extension list used by both the in-browser editor and the
 * server-side renderer. Keep this in sync with whatever the editor allows so
 * email render output matches what the author saw while editing.
 */

import StarterKit from "@tiptap/starter-kit";

export const EMAIL_TIPTAP_EXTENSIONS = [StarterKit];

export type EmailTemplateBody = unknown;
