"use client";

import { CheckCircle2 } from "lucide-react";
import { PACKAGE_OPTIONS, type LeadFormValues } from "./schemas";

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

type Props = {
  values: LeadFormValues;
  date: Date;
  time: string;
};

export function StepConfirmation({ values, date, time }: Props) {
  const packageLabel =
    PACKAGE_OPTIONS.find((opt) => opt.value === values.packageInterest)?.label ??
    "Not sure yet";

  return (
    <div className="text-center py-2">
      <CheckCircle2 className="mx-auto size-12 text-gold mb-4" strokeWidth={1.5} />
      <h3 className="font-heading text-2xl text-forest mb-2">You&apos;re booked in!</h3>
      <p className="text-foreground/70 mb-6">
        Thank you — we&apos;re looking forward to speaking with you.
      </p>

      <div className="bg-sky-light p-5 text-left space-y-3 mb-6">
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.08em] text-forest">Name</p>
          <p className="text-sm text-forest">{values.firstName} {values.lastName}</p>
        </div>
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.08em] text-forest">Email</p>
          <p className="text-sm text-forest">{values.email}</p>
        </div>
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.08em] text-forest">Your Call</p>
          <p className="text-sm text-forest">{formatDate(date)} at {time} PT</p>
        </div>
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.08em] text-forest">Package Interest</p>
          <p className="text-sm text-forest">{packageLabel}</p>
        </div>
      </div>

      <p className="text-sm italic text-tofino">
        Check your email for a confirmation. If you need to reschedule, just reply to that email.
      </p>
    </div>
  );
}
