"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LeadStage } from "@/lib/admin/stages";
import type { LeadDetail } from "@/lib/admin/lead-detail-types";

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

const STALE_DAYS = 14;
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
  stage: LeadStage;
  createdAt: Date;
  updatedAt: Date;
  nextEmailJob: LeadDetail["nextEmailJob"];
  upcomingBooking: LeadDetail["upcomingBooking"];
};

export function KanbanCard({
  lead,
  isOverlay = false,
  draggable = true,
}: {
  lead: KanbanLeadRow;
  isOverlay?: boolean;
  /**
   * When false, the card renders without dnd-kit wiring — used during SSR
   * to avoid hydration mismatches around dnd-kit's internal IDs.
   */
  draggable?: boolean;
}) {
  return draggable ? (
    <DraggableCard lead={lead} isOverlay={isOverlay} />
  ) : (
    <StaticCard lead={lead} />
  );
}

function StaticCard({ lead }: { lead: KanbanLeadRow }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <button
      type="button"
      onClick={() => openLeadModal(router, pathname, params, lead.id)}
      className={cardClassName({ isDragging: false, isOverlay: false })}
    >
      <CardBody lead={lead} draggable={false} />
    </button>
  );
}

function DraggableCard({
  lead,
  isOverlay,
}: {
  lead: KanbanLeadRow;
  isOverlay: boolean;
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
      <CardBody lead={lead} draggable={true} />
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
    "group block w-full text-left bg-white border border-forest/10 px-3 py-2.5 cursor-pointer touch-none",
    "hover:border-gold/50",
    isDragging && "opacity-30",
    isOverlay && "border-gold shadow-md",
  );
}

function CardBody({
  lead,
  draggable,
}: {
  lead: KanbanLeadRow;
  draggable: boolean;
}) {
  const isCold =
    lead.stage === "new" &&
    Date.now() - lead.createdAt.getTime() > STALE_DAYS * DAY_MS;

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-heading text-sm text-forest leading-tight truncate">
          {lead.firstName} {lead.lastName}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-heading text-[0.6rem] uppercase tracking-[0.1em] text-tofino">
            {PACKAGE_BADGES[lead.packageInterest]}
          </span>
          {draggable && (
            <span
              aria-hidden
              title="Drag to move"
              className="text-tofino/40 group-hover:text-tofino/80 text-xs leading-none select-none"
            >
              ⋮⋮
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-tofino truncate mb-2">{lead.email}</p>

      {lead.stage === "booked_a_call" && lead.upcomingBooking && (
        <p className="text-xs font-heading text-gold">
          {dateTimeFmt.format(lead.upcomingBooking.scheduledAt)}
        </p>
      )}

      {lead.nextEmailJob && (
        <p className="text-[0.7rem] text-tofino italic truncate">
          Next: {lead.nextEmailJob.templateName} ·{" "}
          {dateFmt.format(lead.nextEmailJob.sendAt)}
        </p>
      )}

      {!lead.nextEmailJob &&
        (lead.stage === "new" ||
          lead.stage === "stale" ||
          lead.stage === "booked_a_call") && (
          <p className="text-[0.7rem] text-tofino italic">No emails queued</p>
        )}

      {(lead.stage === "closed" ||
        lead.stage === "lost" ||
        lead.stage === "post_video_shoot" ||
        lead.stage === "video_shoot_scheduled" ||
        lead.stage === "call_completed") && (
        <p className="text-[0.7rem] text-tofino italic">
          Updated {relativeTime(lead.updatedAt)}
        </p>
      )}

      {isCold && (
        <p className="mt-1.5 inline-block text-[0.6rem] uppercase tracking-[0.1em] font-heading text-amber-700 bg-amber-100/70 border border-amber-300/60 px-1.5 py-0.5">
          Cold · {relativeTime(lead.createdAt)}
        </p>
      )}
    </>
  );
}
