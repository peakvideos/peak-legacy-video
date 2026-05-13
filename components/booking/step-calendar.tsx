"use client";

import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const isWeekend = (date: Date) => {
  const d = date.getDay();
  return d === 0 || d === 6;
};

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const toIsoDate = (date: Date) => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; slots: string[] }
  | { status: "empty"; reason: "weekend" | "past" | "none" }
  | { status: "error"; message: string };

type Props = {
  selectedDate: Date | undefined;
  selectedTime: string | undefined;
  onSelectDate: (date: Date | undefined) => void;
  onSelectTime: (time: string) => void;
};

export function StepCalendar({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: Props) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (!selectedDate) {
      setFetchState({ status: "idle" });
      return;
    }
    const isoDate = toIsoDate(selectedDate);
    const controller = new AbortController();
    setFetchState({ status: "loading" });

    fetch(`/api/availability?date=${isoDate}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const data: { slots?: string[]; reason?: "weekend" | "past" } = await res.json();
        const slots = data.slots ?? [];
        if (slots.length === 0) {
          setFetchState({
            status: "empty",
            reason: data.reason ?? "none",
          });
        } else {
          setFetchState({ status: "ok", slots });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFetchState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      });

    return () => controller.abort();
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <p className="text-sm italic text-tofino">
        Select a date and time for your 30-minute discovery call. All times are Pacific Time (PT).
      </p>

      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelectDate}
          disabled={[{ before: today() }, isWeekend]}
          showOutsideDays={false}
          className="rounded-md border-0"
        />
      </div>

      {!selectedDate && (
        <p className="text-sm italic text-tofino">
          Please select a date above to see available times.
        </p>
      )}

      {selectedDate && fetchState.status === "loading" && (
        <SlotShell label={`Available times for ${formatDayLabel(selectedDate)}`}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-forest/8 animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        </SlotShell>
      )}

      {selectedDate && fetchState.status === "ok" && (
        <SlotShell label={`Available times for ${formatDayLabel(selectedDate)}`}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {fetchState.slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onSelectTime(slot)}
                className={cn(
                  "py-2.5 px-2 text-sm border transition-colors cursor-pointer",
                  selectedTime === slot
                    ? "bg-forest border-forest text-white"
                    : "bg-white border-forest/18 text-forest hover:border-gold hover:text-gold",
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        </SlotShell>
      )}

      {selectedDate && fetchState.status === "empty" && (
        <p className="text-sm italic text-tofino">
          {emptyMessage(fetchState.reason)}
        </p>
      )}

      {selectedDate && fetchState.status === "error" && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load times for that day. Please try another date or try again.
        </p>
      )}
    </div>
  );
}

function SlotShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-heading text-xs uppercase tracking-[0.12em] text-forest mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

function emptyMessage(reason: "weekend" | "past" | "none"): string {
  if (reason === "weekend") return "Discovery calls are Monday through Friday only.";
  if (reason === "past") return "That date has already passed — please pick another.";
  return "No times available on that day. Please try another.";
}
