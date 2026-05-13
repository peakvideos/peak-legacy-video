"use client";

import { Toaster as Sonner } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";
import { useAdminTheme } from "./admin-theme";

/**
 * Admin-scoped Toaster — reads from useAdminTheme so toasts match the
 * operator's chosen theme without leaning on next-themes.
 */
export function AdminToaster() {
  const { theme } = useAdminTheme();

  return (
    <Sonner
      theme={theme}
      richColors
      closeButton
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--adm-surface)",
          "--normal-text": "var(--adm-text)",
          "--normal-border": "var(--adm-border-strong)",
        } as React.CSSProperties
      }
    />
  );
}
