"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { isCold } from "@/lib/admin/cold";
import type { StageRow, StageSettings } from "@/lib/admin/stages";
import type { LeadDetail } from "@/lib/admin/lead-detail-types";
import { ColdBadge } from "./shared";

const PACKAGE_BADGES = {
  legacy: "Legacy",
  heirloom: "Heirloom",
  unsure: "Unsure",
} as const;

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

const DAY_MS = 24 * 60 * 60 * 1000;

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / DAY_MS);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export type KanbanLeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  packageInterest: "legacy" | "heirloom" | "unsure";
  stageId: string;
  createdAt: Date;
  updatedAt: Date;
  nextEmailJob: LeadDetail["nextEmailJob"];
  upcomingBooking: LeadDetail["upcomingBooking"];
};

export function KanbanCard({
  lead,
  stage,
  settings,
  bookingStagePosition,
  isOverlay = false,
  draggable = true,
}: {
  lead: KanbanLeadRow;
  /** The stage the lead currently sits in. */
  stage: StageRow | undefined;
  settings: StageSettings;
  /** Position of the Booking Stage — cards at or before it talk email-drip. */
  bookingStagePosition: number;
  isOverlay?: boolean;
  /**
   * When false, the card renders without dnd-kit wiring — used during SSR
   * to avoid hydration mismatches around dnd-kit's internal IDs.
   */
  draggable?: boolean;
}) {
  const body = (
    <CardBody
      lead={lead}
      stage={stage}
      settings={settings}
      bookingStagePosition={bookingStagePosition}
      draggable={draggable && !isOverlay}
    />
  );
  return draggable ? (
    <DraggableCard lead={lead} isOverlay={isOverlay}>
      {body}
    </DraggableCard>
  ) : (
    <StaticCard lead={lead}>{body}</StaticCard>
  );
}

function StaticCard({
  lead,
  children,
}: {
  lead: KanbanLeadRow;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <button
      type="button"
      onClick={() => openLeadModal(router, pathname, params, lead.id)}
      className={cardClassName({ isDragging: false, isOverlay: false })}
    >
      {children}
    </button>
  );
}

function DraggableCard({
  lead,
  isOverlay,
  children,
}: {
  lead: KanbanLeadRow;
  isOverlay: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: isOverlay,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={() => openLeadModal(router, pathname, params, lead.id)}
      {...listeners}
      {...attributes}
      className={cardClassName({ isDragging, isOverlay })}
    >
      {children}
    </button>
  );
}

function openLeadModal(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  params: ReturnType<typeof useSearchParams>,
  leadId: string,
) {
  const sp = new URLSearchParams(params.toString());
  sp.set("lead", leadId);
  router.push(`${pathname}?${sp.toString()}`, { scroll: false });
}

function cardClassName({
  isDragging,
  isOverlay,
}: {
  isDragging: boolean;
  isOverlay: boolean;
}) {
  return cn(
    "group block w-full text-left bg-(--adm-surface) border border-(--adm-border) px-3 py-2.5 cursor-pointer touch-none",
    "hover:border-gold/50",
    isDragging && "opacity-30",
    isOverlay && "border-gold shadow-md",
  );
}

function CardBody({
  lead,
  stage,
  settings,
  bookingStagePosition,
  draggable,
}: {
  lead: KanbanLeadRow;
  stage: StageRow | undefined;
  settings: StageSettings;
  bookingStagePosition: number;
  draggable: boolean;
}) {
  const cold = isCold(lead, stage, settings.coldThresholdDays);

  // Up to the Booking Stage the pipeline is email-driven, so an empty queue
  // is worth calling out; past it the lead is in the owner's hands and the
  // last touch matters more.
  const preBooking = !!stage && stage.position <= bookingStagePosition;

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-heading text-sm text-(--adm-text) leading-tight truncate">
          {lead.firstName} {lead.lastName}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-heading text-[0.6rem] uppercase tracking-[0.1em] text-(--adm-text-muted)">
            {PACKAGE_BADGES[lead.packageInterest]}
          </span>
          {draggable && (
            <span
              aria-hidden
              title="Drag to move"
              className="text-(--adm-text-muted) opacity-40 group-hover:opacity-80 text-xs leading-none select-none"
            >
              ⋮⋮
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-(--adm-text-muted) truncate mb-2">{lead.email}</p>

      {lead.stageId === settings.bookingStageId && lead.upcomingBooking && (
        <p className="text-xs font-heading text-gold">
          {dateTimeFmt.format(lead.upcomingBooking.scheduledAt)}
        </p>
      )}

      {lead.nextEmailJob && (
        <p className="text-[0.7rem] text-(--adm-text-muted) truncate">
          Next: {lead.nextEmailJob.templateName} ·{" "}
          {dateFmt.format(lead.nextEmailJob.sendAt)}
        </p>
      )}

      {!lead.nextEmailJob && preBooking && (
        <p className="text-[0.7rem] text-(--adm-text-muted)">No emails queued</p>
      )}

      {!preBooking && (
        <p className="text-[0.7rem] text-(--adm-text-muted)">
          Updated {relativeTime(lead.updatedAt)}
        </p>
      )}

      {cold && (
        <p className="mt-1.5">
          <ColdBadge detail={relativeTime(lead.updatedAt)} />
        </p>
      )}
    </>
  );
}
