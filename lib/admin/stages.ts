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

export const STAGE_BUTTON_STYLE: Record<
  LeadStage,
  { active: string; idle: string }
> = {
  new: {
    active: "bg-gold text-forest",
    idle: "border border-gold/40 text-tofino hover:border-gold hover:text-forest",
  },
  stale: {
    active: "bg-tofino text-white",
    idle: "border border-tofino/40 text-tofino hover:border-tofino hover:text-forest",
  },
  booked_a_call: {
    active: "bg-gold text-forest",
    idle: "border border-gold/40 text-tofino hover:border-gold hover:text-forest",
  },
  call_completed: {
    active: "bg-sky text-forest",
    idle: "border border-sky/40 text-tofino hover:border-sky hover:text-forest",
  },
  video_shoot_scheduled: {
    active: "bg-moss text-white",
    idle: "border border-moss/40 text-tofino hover:border-moss hover:text-forest",
  },
  post_video_shoot: {
    active: "bg-blush/60 text-forest",
    idle: "border border-blush/30 text-tofino hover:border-blush hover:text-forest",
  },
  closed: {
    active: "bg-forest text-white",
    idle: "border border-forest/30 text-tofino hover:border-forest hover:text-forest",
  },
  lost: {
    active: "bg-blush/70 text-forest",
    idle: "border border-blush/40 text-tofino hover:border-blush hover:text-forest",
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
