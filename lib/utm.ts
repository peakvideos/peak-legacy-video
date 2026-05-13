export type UtmParams = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};

const KEYS = ["source", "medium", "campaign", "content", "term"] as const;

export function readUtmFromLocation(): UtmParams {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: UtmParams = {};
  for (const k of KEYS) {
    const v = params.get(`utm_${k}`);
    if (v) out[k] = v;
  }
  return out;
}
