/**
 * Client-safe helpers over stage rows. Stage data itself is loaded on the
 * server (`lib/stages`); these map a stage's palette key to Tailwind
 * classes and derive the board's view split. Nothing here may key off a
 * stage's name — only its data.
 */

/** The serializable stage shape passed from server pages to the admin UI. */
export type StageRow = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  position: number;
  isWon: boolean;
  isLost: boolean;
  needsAction: boolean;
};

/** The settings the admin UI binds display behavior to. */
export type StageSettings = {
  entryStageId: string;
  bookingStageId: string;
  coldThresholdDays: number;
};

export type StagePalette = {
  /** Kanban column top border. */
  tone: string;
  /** StageBadge chip. */
  badge: string;
  /** Stage-action buttons in the lead detail. */
  button: { active: string; idle: string };
};

const IDLE_BASE = "border text-(--adm-text-muted) hover:text-(--adm-text)";

const PALETTES: Record<string, StagePalette> = {
  gold: {
    tone: "border-gold/60",
    badge: "bg-gold/15 border-gold/40 text-gold",
    button: {
      active: "bg-gold text-forest",
      idle: `${IDLE_BASE} border-gold/40 hover:border-gold`,
    },
  },
  "gold-soft": {
    tone: "border-gold/50",
    badge: "bg-gold/15 border-gold/40 text-gold",
    button: {
      active: "bg-gold text-forest",
      idle: `${IDLE_BASE} border-gold/40 hover:border-gold`,
    },
  },
  tofino: {
    tone: "border-tofino/40",
    badge: "bg-tofino/15 border-tofino/40 text-tofino",
    button: {
      active: "bg-tofino text-white",
      idle: `${IDLE_BASE} border-tofino/40 hover:border-tofino`,
    },
  },
  sky: {
    tone: "border-sky/50",
    badge: "bg-sky/30 border-tofino/40 text-tofino",
    button: {
      active: "bg-sky text-forest",
      idle: `${IDLE_BASE} border-sky/40 hover:border-sky`,
    },
  },
  moss: {
    tone: "border-moss/50",
    badge: "bg-moss/20 border-moss/45 text-moss",
    button: {
      active: "bg-moss text-white",
      idle: `${IDLE_BASE} border-moss/40 hover:border-moss`,
    },
  },
  "blush-soft": {
    tone: "border-blush/30",
    badge: "bg-blush/20 border-blush/45 text-blush",
    button: {
      active: "bg-blush/60 text-forest",
      idle: `${IDLE_BASE} border-blush/30 hover:border-blush`,
    },
  },
  blush: {
    tone: "border-blush/50",
    badge: "bg-blush/30 border-blush/60 text-blush",
    button: {
      active: "bg-blush/70 text-forest",
      idle: `${IDLE_BASE} border-blush/40 hover:border-blush`,
    },
  },
  forest: {
    tone: "border-forest/50",
    badge: "bg-forest border-forest text-gold",
    button: {
      active: "bg-forest text-white",
      idle: `${IDLE_BASE} border-forest/30 hover:border-forest`,
    },
  },
};

const FALLBACK_PALETTE: StagePalette = {
  tone: "border-(--adm-border)",
  badge: "border-(--adm-border) text-(--adm-text-muted)",
  button: {
    active: "bg-(--adm-surface-2) text-(--adm-text)",
    idle: `${IDLE_BASE} border-(--adm-border) hover:border-gold`,
  },
};

export function stagePalette(color: string): StagePalette {
  return PALETTES[color] ?? FALLBACK_PALETTE;
}

/**
 * The board's two views. "Settled" is the trailing run of flagged stages
 * (Won, Lost, or Needs-action) at the end of the pipeline — the
 * end-of-journey block; the "Active funnel" is everything before it.
 */
export function splitBoardViews(stages: StageRow[]): {
  active: StageRow[];
  settled: StageRow[];
} {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  let splitAt = ordered.length;
  while (splitAt > 0) {
    const s = ordered[splitAt - 1];
    if (s.isWon || s.isLost || s.needsAction) {
      splitAt -= 1;
    } else {
      break;
    }
  }
  return { active: ordered.slice(0, splitAt), settled: ordered.slice(splitAt) };
}
