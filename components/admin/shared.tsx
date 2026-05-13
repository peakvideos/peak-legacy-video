import { cn } from "@/lib/utils";
import type { LeadStage } from "@/lib/admin/stages";
import { STAGE_LABELS } from "@/lib/admin/stages";

export type PackageInterest = "legacy" | "heirloom" | "unsure";

const PKG_LABELS: Record<PackageInterest, string> = {
  legacy: "Legacy",
  heirloom: "Heirloom",
  unsure: "Unsure",
};

export function PackageBadge({ pkg }: { pkg: PackageInterest }) {
  const tone =
    pkg === "legacy"
      ? "bg-gold/12 border-gold/35 text-gold"
      : pkg === "heirloom"
        ? "bg-moss/18 border-moss/45 text-moss"
        : "border-(--adm-border) text-(--adm-text-muted)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-px border font-heading text-[0.62rem] uppercase tracking-[0.08em]",
        tone,
      )}
    >
      {PKG_LABELS[pkg]}
    </span>
  );
}

const STAGE_TONES: Record<LeadStage, string> = {
  new: "bg-gold/15 border-gold/40 text-gold",
  stale: "bg-blush/20 border-blush/45 text-blush",
  booked_a_call: "bg-gold/15 border-gold/40 text-gold",
  call_completed: "bg-sky/30 border-tofino/40 text-tofino",
  video_shoot_scheduled: "bg-moss/20 border-moss/45 text-moss",
  post_video_shoot: "bg-blush/20 border-blush/45 text-blush",
  closed: "bg-forest border-forest text-gold",
  lost: "bg-blush/30 border-blush/60 text-blush",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-px border font-heading text-[0.62rem] uppercase tracking-[0.08em]",
        STAGE_TONES[stage],
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function Avatar({
  first,
  last,
  size = 28,
}: {
  first: string;
  last: string;
  size?: number;
}) {
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
      className="rounded-full bg-(--adm-surface-2) text-(--adm-text) font-heading inline-flex items-center justify-center shrink-0 tracking-wider border border-(--adm-border)"
    >
      {initials}
    </span>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function relativeTime(date: Date | number): string {
  const ts = typeof date === "number" ? date : date.getTime();
  const diff = Date.now() - ts;
  const future = diff < 0;
  const absDays = Math.floor(Math.abs(diff) / DAY_MS);
  if (future) {
    if (absDays === 0) return "today";
    if (absDays === 1) return "tomorrow";
    if (absDays < 7) return `in ${absDays}d`;
    if (absDays < 30) return `in ${Math.floor(absDays / 7)}w`;
    return `in ${Math.floor(absDays / 30)}mo`;
  }
  if (absDays === 0) return "today";
  if (absDays === 1) return "yesterday";
  if (absDays < 30) return `${absDays}d ago`;
  if (absDays < 365) return `${Math.floor(absDays / 30)}mo ago`;
  return `${Math.floor(absDays / 365)}y ago`;
}

const TIME_FMT = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
});

const DATE_LONG_FMT = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  day: "numeric",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

export function timeLabel(date: Date | number): string {
  return TIME_FMT.format(typeof date === "number" ? new Date(date) : date);
}

export function dayLabel(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = (target.getTime() - today.getTime()) / DAY_MS;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0 && diff < 7) return DAY_FMT.format(d);
  if (diff < 0 && diff > -7) return `Last ${DAY_FMT.format(d)}`;
  return DAY_FMT.format(d);
}

export function dateLongLabel(date: Date | number): string {
  return DATE_LONG_FMT.format(typeof date === "number" ? new Date(date) : date);
}

export function dateTimeLabel(date: Date | number): string {
  return DATE_TIME_FMT.format(typeof date === "number" ? new Date(date) : date);
}

export function ToolbarHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-(--adm-border) bg-(--adm-surface) flex-wrap">
      <div>
        <div className="text-lg text-(--adm-text) leading-tight">{title}</div>
        {subtitle && (
          <div className="text-[11px] text-(--adm-text-muted) mt-0.5">{subtitle}</div>
        )}
      </div>
      {right && (
        <div className="flex items-center gap-2 flex-wrap">{right}</div>
      )}
    </div>
  );
}

export function DayDivider({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="px-6 py-2.5 bg-(--adm-surface-2) border-b border-(--adm-border) sticky top-0 z-2 font-heading text-[0.62rem] uppercase tracking-[0.18em] text-(--adm-text-muted)">
      {label}
      {sub && <span className="ml-1 opacity-70">· {sub}</span>}
    </div>
  );
}
