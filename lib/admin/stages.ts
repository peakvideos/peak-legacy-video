import type { LeadStage } from "@/lib/email/sequence";

export type { LeadStage };

/**
 * Funnel ordering — used by the kanban (column order) and the stage-action
 * buttons inside the lead detail.
 */
export const STAGE_ORDER: LeadStage[] = [
  "new",
  "stale",
  "booked_a_call",
  "call_completed",
  "video_shoot_scheduled",
  "post_video_shoot",
  "closed",
  "lost",
];

/** Stages shown in the default kanban view ("Active funnel"). */
export const ACTIVE_STAGES: LeadStage[] = [
  "new",
  "stale",
  "booked_a_call",
  "call_completed",
  "video_shoot_scheduled",
];

/** Stages shown in the secondary kanban view ("Settled"). */
export const SETTLED_STAGES: LeadStage[] = [
  "post_video_shoot",
  "closed",
  "lost",
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  stale: "Stale",
  booked_a_call: "Booked a call",
  call_completed: "Call completed",
  video_shoot_scheduled: "Video shoot scheduled",
  post_video_shoot: "Post video shoot",
  closed: "Closed",
  lost: "Lost",
};

export const STAGE_TONE: Record<LeadStage, string> = {
  new: "border-gold/60",
  stale: "border-tofino/40",
  booked_a_call: "border-gold/50",
  call_completed: "border-sky/50",
  video_shoot_scheduled: "border-moss/50",
  post_video_shoot: "border-blush/30",
  closed: "border-forest/50",
  lost: "border-blush/50",
};

const IDLE_BASE =
  "border text-(--adm-text-muted) hover:text-(--adm-text)";

export const STAGE_BUTTON_STYLE: Record<
  LeadStage,
  { active: string; idle: string }
> = {
  new: {
    active: "bg-gold text-forest",
    idle: `${IDLE_BASE} border-gold/40 hover:border-gold`,
  },
  stale: {
    active: "bg-tofino text-white",
    idle: `${IDLE_BASE} border-tofino/40 hover:border-tofino`,
  },
  booked_a_call: {
    active: "bg-gold text-forest",
    idle: `${IDLE_BASE} border-gold/40 hover:border-gold`,
  },
  call_completed: {
    active: "bg-sky text-forest",
    idle: `${IDLE_BASE} border-sky/40 hover:border-sky`,
  },
  video_shoot_scheduled: {
    active: "bg-moss text-white",
    idle: `${IDLE_BASE} border-moss/40 hover:border-moss`,
  },
  post_video_shoot: {
    active: "bg-blush/60 text-forest",
    idle: `${IDLE_BASE} border-blush/30 hover:border-blush`,
  },
  closed: {
    active: "bg-forest text-white",
    idle: `${IDLE_BASE} border-forest/30 hover:border-forest`,
  },
  lost: {
    active: "bg-blush/70 text-forest",
    idle: `${IDLE_BASE} border-blush/40 hover:border-blush`,
  },
};

/**
 * Stages where automations and "next email" callouts don't make sense
 * because the lead has either reached a terminal state or been parked
 * outside the active funnel.
 */
export const TERMINAL_STAGES: ReadonlySet<LeadStage> = new Set([
  "closed",
  "lost",
]);
