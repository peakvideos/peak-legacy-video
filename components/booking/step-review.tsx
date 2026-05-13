"use client";

import { Checkbox } from "@/components/ui/checkbox";
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
  consent: boolean;
  onConsentChange: (next: boolean) => void;
};

export function StepReview({ values, date, time, consent, onConsentChange }: Props) {
  const packageLabel =
    PACKAGE_OPTIONS.find((opt) => opt.value === values.packageInterest)?.label ??
    "Not sure yet";

  return (
    <div className="space-y-5">
      <p className="text-sm text-foreground/70">
        Please review your booking details before confirming.
      </p>

      <div className="bg-forest/4 border-l-[3px] border-gold p-4 text-sm text-foreground/70 space-y-1">
        <p className="font-heading text-xs uppercase tracking-[0.08em] text-forest mb-2">
          Your Booking
        </p>
        <p>
          <span className="font-medium text-forest">Name:</span> {values.firstName} {values.lastName}
        </p>
        <p>
          <span className="font-medium text-forest">Email:</span> {values.email}
        </p>
        {values.phone ? (
          <p>
            <span className="font-medium text-forest">Phone:</span> {values.phone}
          </p>
        ) : null}
        <p>
          <span className="font-medium text-forest">Date:</span> {formatDate(date)}
        </p>
        <p>
          <span className="font-medium text-forest">Time:</span> {time} Pacific Time
        </p>
        <p>
          <span className="font-medium text-forest">Package interest:</span> {packageLabel}
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
        <Checkbox
          checked={consent}
          onCheckedChange={(next) => onConsentChange(next === true)}
          className="mt-0.5"
          aria-label="Consent to be contacted"
        />
        <span>
          I agree to be contacted by Peak Studios CO regarding my booking enquiry.
        </span>
      </label>

      <p className="text-xs italic text-tofino">
        We&apos;ll send a confirmation email and one of our team will be in touch shortly.
      </p>
    </div>
  );
}
