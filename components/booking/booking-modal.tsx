"use client";

import { useEffect, useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProgressDots } from "./progress-dots";
import { StepLeadForm } from "./step-lead-form";
import { StepCalendar } from "./step-calendar";
import { StepReview } from "./step-review";
import { StepConfirmation } from "./step-confirmation";
import { type LeadFormValues, type PackageInterest } from "./schemas";
import { type BookingVariant } from "./booking-modal-provider";
import { cn } from "@/lib/utils";
import { trackLead } from "@/lib/meta-pixel";
import { readUtmFromLocation } from "@/lib/utm";

type Step = 1 | 2 | 3 | "confirm";

const TITLES: Record<BookingVariant, { title: string; subtitle: string }> = {
  session: {
    title: "Book Your Discovery Call",
    subtitle: "30 minutes · Monday–Friday · Pacific Time",
  },
  questions: {
    title: "Have a Question?",
    subtitle: "Book a quick chat — 30 min, no commitment.",
  },
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: BookingVariant;
  initialPackage?: PackageInterest;
};

export function BookingModal({ open, onOpenChange, variant, initialPackage }: Props) {
  const formId = useId();
  const [step, setStep] = useState<Step>(1);
  const [formValues, setFormValues] = useState<LeadFormValues | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedDate(undefined);
      setSelectedTime(undefined);
      setConsent(false);
      setSubmitting(false);
      setSubmitError(null);
      setSavingLead(false);
      setLeadError(null);
    }
  }, [open]);

  const { title, subtitle } = TITLES[variant];

  const handleLeadSubmit = async (values: LeadFormValues) => {
    setSavingLead(true);
    setLeadError(null);

    const utm = readUtmFromLocation();
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone || undefined,
          packageInterest: values.packageInterest,
          notes: values.notes || undefined,
          utm: Object.keys(utm).length > 0 ? utm : undefined,
        }),
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setLeadError(
          data.error ?? "Couldn't save your details. Please try again.",
        );
        setSavingLead(false);
        return;
      }

      setFormValues(values);
      setStep(2);
    } catch (err) {
      console.error("[lead] submit failed", err);
      setLeadError("Network error. Please check your connection and try again.");
    } finally {
      setSavingLead(false);
    }
  };

  const handleCalendarNext = () => {
    if (!selectedDate || !selectedTime) return;
    setStep(3);
  };

  const handleConfirm = async () => {
    if (!formValues || !selectedDate || !selectedTime || !consent) return;
    setSubmitting(true);
    setSubmitError(null);

    const isoDate = toIsoLocalDate(selectedDate);
    const utm = readUtmFromLocation();

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formValues.firstName,
          lastName: formValues.lastName,
          email: formValues.email,
          phone: formValues.phone || undefined,
          packageInterest: formValues.packageInterest,
          notes: formValues.notes || undefined,
          date: isoDate,
          time: selectedTime,
          consent: true,
          utm: Object.keys(utm).length > 0 ? utm : undefined,
        }),
      });

      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSubmitError(
          data.error ?? "Something went wrong. Please try again or contact us directly.",
        );
        setSubmitting(false);
        return;
      }

      trackLead();
      setStep("confirm");
    } catch (err) {
      console.error("[booking] submit failed", err);
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-xl gap-0 p-0 overflow-hidden border-t-4 border-gold"
        showCloseButton={false}
      >
        <header className="bg-forest px-6 py-5 sm:px-8 sm:py-6 relative">
          <DialogTitle className="text-white text-lg sm:text-xl font-medium">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sky italic font-sans text-sm mt-1">
            {subtitle}
          </DialogDescription>
        </header>

        <div className="px-6 py-6 sm:px-8 sm:py-7 max-h-[70vh] overflow-y-auto">
          {step !== "confirm" && <ProgressDots current={step} />}

          {step === 1 && (
            <>
              <StepLeadForm
                formId={formId}
                initialValues={formValues ?? undefined}
                initialPackage={initialPackage}
                onComplete={handleLeadSubmit}
              />
              {leadError && (
                <p className="mt-4 text-sm text-destructive">{leadError}</p>
              )}
            </>
          )}

          {step === 2 && (
            <StepCalendar
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onSelectDate={(d) => {
                setSelectedDate(d);
                setSelectedTime(undefined);
              }}
              onSelectTime={setSelectedTime}
            />
          )}

          {step === 3 && formValues && selectedDate && selectedTime && (
            <>
              <StepReview
                values={formValues}
                date={selectedDate}
                time={selectedTime}
                consent={consent}
                onConsentChange={setConsent}
              />
              {submitError && (
                <p className="mt-4 text-sm text-destructive">{submitError}</p>
              )}
            </>
          )}

          {step === "confirm" && formValues && selectedDate && selectedTime && (
            <StepConfirmation
              values={formValues}
              date={selectedDate}
              time={selectedTime}
            />
          )}
        </div>

        {step !== "confirm" && (
          <footer className="flex items-center justify-between gap-3 border-t border-forest/8 px-6 py-4 sm:px-8 bg-white">
            <button
              type="button"
              onClick={handleBack}
              className={cn(
                "text-tofino italic font-sans text-sm transition-colors hover:text-forest cursor-pointer",
                step === 1 && "invisible",
              )}
            >
              ← Back
            </button>

            {step === 1 && (
              <button
                type="submit"
                form={formId}
                disabled={savingLead}
                className="bg-forest text-white font-heading text-xs tracking-[0.1em] uppercase px-7 py-3 transition hover:bg-forest-deep cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {savingLead ? "Saving…" : "Next →"}
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                disabled={!selectedDate || !selectedTime}
                onClick={handleCalendarNext}
                className="bg-forest text-white font-heading text-xs tracking-[0.1em] uppercase px-7 py-3 transition hover:bg-forest-deep cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-forest"
              >
                Next →
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                disabled={!consent || submitting}
                onClick={handleConfirm}
                className="bg-gold text-forest font-heading text-xs tracking-[0.1em] uppercase px-7 py-3 transition hover:bg-gold-light cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gold"
              >
                {submitting ? "Confirming…" : "Confirm Booking"}
              </button>
            )}
          </footer>
        )}

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute top-4 right-4 text-sky/80 hover:text-gold text-2xl leading-none cursor-pointer"
        >
          ×
        </button>
      </DialogContent>
    </Dialog>
  );
}

function toIsoLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}
