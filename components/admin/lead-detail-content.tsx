import { Badge } from "@/components/ui/badge";
import { CrmNotesEditor } from "./crm-notes-editor";
import { StageActions } from "./stage-actions";
import { CancelJobButton } from "./cancel-job-button";
import { OneOffComposer } from "./one-off-composer";
import { UnsubscribeToggle } from "./unsubscribe-toggle";
import type { LeadDetail } from "@/lib/admin/lead-detail-types";

const PACKAGE_LABELS = {
  legacy: "The Legacy ($2,500)",
  heirloom: "The Heirloom ($3,500)",
  unsure: "Not sure yet",
} as const;

const dateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function LeadDetailContent({ data }: { data: LeadDetail }) {
  const {
    lead,
    stages,
    bookings: leadBookings,
    emailJobs: leadJobs,
    nextEmailJob,
    upcomingBooking,
  } = data;

  const currentStage = stages.find((s) => s.id === lead.stageId);

  const utm = [
    ["Source", lead.utmSource],
    ["Medium", lead.utmMedium],
    ["Campaign", lead.utmCampaign],
    ["Content", lead.utmContent],
    ["Term", lead.utmTerm],
  ].filter(([, v]) => v) as Array<[string, string]>;

  const isTerminal = !!currentStage && (currentStage.isWon || currentStage.isLost);
  const showNextEmail = !!nextEmailJob && !isTerminal;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-(--adm-text) text-2xl">
            {lead.firstName} {lead.lastName}
          </h2>
          <p className="text-(--adm-text-muted) text-sm">
            <a href={`mailto:${lead.email}`} className="hover:text-gold">
              {lead.email}
            </a>
            {lead.phone ? ` · ${lead.phone}` : ""}
          </p>
        </div>
        <OneOffComposer
          leadId={lead.id}
          leadEmail={lead.email}
          leadFirstName={lead.firstName}
        />
      </header>

      {lead.unsubscribedAt && (
        <UnsubscribeToggle
          leadId={lead.id}
          unsubscribedAt={lead.unsubscribedAt}
        />
      )}

      {(upcomingBooking || showNextEmail) && (
        <section className="bg-(--adm-surface-2) border-l-2 border-gold p-4 space-y-2">
          {upcomingBooking && (
            <div>
              <p className="font-heading text-[0.7rem] uppercase tracking-[0.12em] text-(--adm-text-muted) mb-1">
                Upcoming call
              </p>
              <p className="font-heading text-(--adm-text)">
                {dateTimeFmt.format(upcomingBooking.scheduledAt)}
              </p>
            </div>
          )}
          {showNextEmail && nextEmailJob && (
            <div>
              <p className="font-heading text-[0.7rem] uppercase tracking-[0.12em] text-(--adm-text-muted) mb-1">
                Next email
              </p>
              <p className="text-sm text-(--adm-text)">
                {nextEmailJob.templateName} —{" "}
                <span className="text-(--adm-text-muted)">
                  {dateFmt.format(nextEmailJob.sendAt)}
                </span>
              </p>
            </div>
          )}
        </section>
      )}

      <section>
        <p className="font-heading text-[0.7rem] uppercase tracking-[0.12em] text-(--adm-text-muted) mb-2">
          Stage
        </p>
        <StageActions
          leadId={lead.id}
          currentStageId={lead.stageId}
          stages={stages}
        />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-(--adm-surface) border border-(--adm-border) p-5">
        <Field
          label="Package interest"
          value={PACKAGE_LABELS[lead.packageInterest]}
        />
        <Field label="Source" value={lead.source} />
        <Field label="Submitted" value={dateFmt.format(lead.createdAt)} />
        <Field label="Last updated" value={dateFmt.format(lead.updatedAt)} />
        {lead.notes && (
          <div className="sm:col-span-2">
            <Field label="Notes from form" value={lead.notes} />
          </div>
        )}
        {utm.length > 0 && (
          <div className="sm:col-span-2 pt-2 border-t border-(--adm-border)">
            <p className="font-heading text-[0.7rem] uppercase tracking-[0.12em] text-(--adm-text-muted) mb-2">
              UTM
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {utm.map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="text-(--adm-text-muted)">{label}:</dt>
                  <dd className="text-(--adm-text)">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      <section>
        <CrmNotesEditor leadId={lead.id} initialValue={lead.crmNotes ?? ""} />
      </section>

      {!lead.unsubscribedAt && (
        <section>
          <UnsubscribeToggle leadId={lead.id} unsubscribedAt={null} />
        </section>
      )}

      <section>
        <h3 className="font-heading text-(--adm-text) text-base uppercase tracking-[0.12em] mb-3">
          Bookings
        </h3>
        {leadBookings.length === 0 ? (
          <p className="text-(--adm-text-muted) text-sm">
            No bookings yet for this lead.
          </p>
        ) : (
          <ul className="space-y-2">
            {leadBookings.map((b) => (
              <li
                key={b.id}
                className="bg-(--adm-surface) border border-(--adm-border) border-l-2 border-l-gold p-3 flex items-start justify-between gap-3 flex-wrap text-sm"
              >
                <div>
                  <p className="font-heading text-(--adm-text)">
                    {dateTimeFmt.format(b.scheduledAt)}
                  </p>
                  <p className="text-xs text-(--adm-text-muted) mt-0.5">
                    Created {dateFmt.format(b.createdAt)}
                    {b.gcalEventId ? (
                      <>
                        {" · GCal "}
                        <span className="font-mono">
                          {b.gcalEventId.slice(0, 12)}
                        </span>
                        …
                      </>
                    ) : (
                      " · GCal event not created"
                    )}
                  </p>
                </div>
                <Badge
                  variant={b.status === "scheduled" ? "default" : "outline"}
                  className={
                    b.status === "scheduled"
                      ? "bg-gold/15 text-gold border border-gold/40"
                      : ""
                  }
                >
                  {b.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-heading text-(--adm-text) text-base uppercase tracking-[0.12em] mb-3">
          Email sequence
        </h3>
        {leadJobs.length === 0 ? (
          <p className="text-(--adm-text-muted) text-sm">
            No emails scheduled or sent.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {leadJobs.map((job) => (
              <li
                key={job.id}
                className="bg-(--adm-surface) border border-(--adm-border) px-3 py-2 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-heading text-(--adm-text) truncate">
                    {job.templateName}
                  </p>
                  <p className="text-xs text-(--adm-text-muted) truncate">
                    {job.templateSubject}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-(--adm-text-muted) shrink-0">
                  <span>
                    {job.status === "sent"
                      ? `Sent ${job.sentAt ? dateFmt.format(job.sentAt) : ""}`
                      : `Send ${dateFmt.format(job.sendAt)}`}
                  </span>
                  {job.status === "pending" && (
                    <CancelJobButton
                      jobId={job.id}
                      templateName={job.templateName}
                    />
                  )}
                  <Badge variant="outline" className="capitalize">
                    {job.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-heading text-[0.7rem] uppercase tracking-[0.12em] text-(--adm-text-muted) mb-1">
        {label}
      </p>
      <p className="text-(--adm-text) text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}
