// Automation delays are stored in minutes; these helpers translate between
// that and the owner-facing forms. Shared by the stage automations editor
// and the journey view — imported from client components, so no
// "server-only" guard here.

const DELAY_RE = /^\s*(\d+(?:\.\d+)?)\s*([mhd])\s*$/i;

/** What to tell the owner when parseDelay rejects their input. */
export const DELAY_FORMAT_HINT =
  "Use a number followed by m/h/d (e.g. 5m, 2h, 3d).";

export function parseDelay(input: string): number | null {
  const m = DELAY_RE.exec(input);
  if (!m) {
    // Number("") is 0 — blank input must not coerce to "immediately".
    const trimmed = input.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (Number.isFinite(n) && n >= 0) return n;
    return null;
  }
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(value) || value < 0) return null;
  if (unit === "m") return value;
  if (unit === "h") return value * 60;
  if (unit === "d") return value * 60 * 24;
  return null;
}

export function formatDelay(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

/** The label as a sentence fragment: "immediately", "after 2 days". */
export function formatDelayPhrase(minutes: number): string {
  if (minutes === 0) return "immediately";
  return `after ${formatDelayLabel(minutes)}`;
}

export function formatDelayLabel(minutes: number): string {
  if (minutes === 0) return "immediately";
  const days = minutes / (60 * 24);
  if (Number.isInteger(days) && days >= 1) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const hours = minutes / 60;
  if (Number.isInteger(hours) && hours >= 1) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} min`;
}
