declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackLead(data?: { value?: number; currency?: string }): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "Lead", data ?? {});
}

export function trackViewContent(data?: { content_name?: string }): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "ViewContent", data ?? {});
}

export function getMetaPixelId(): string | undefined {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined;
}
