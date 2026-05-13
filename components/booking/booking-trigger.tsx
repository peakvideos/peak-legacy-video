"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  useBookingModal,
  type BookingVariant,
} from "./booking-modal-provider";
import type { PackageInterest } from "./schemas";

type Variant = "primary" | "ghost" | "outline" | "package-dark" | "package-gold";

type BookingTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  bookingVariant?: BookingVariant;
  packageInterest?: PackageInterest;
  styleVariant?: Variant;
  children: ReactNode;
};

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-gold text-forest font-heading text-sm tracking-[0.1em] uppercase px-9 py-4 shadow-[0_4px_18px_rgba(206,166,74,0.28)] transition hover:bg-gold-light hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(206,166,74,0.38)] cursor-pointer",
  ghost:
    "text-sky font-sans italic text-base border-b border-sky/40 pb-0.5 transition hover:text-white hover:border-white cursor-pointer",
  outline:
    "border-2 border-forest text-forest font-heading text-sm tracking-[0.1em] uppercase px-8 py-3 transition hover:bg-forest hover:text-white cursor-pointer",
  "package-dark":
    "block w-full text-center bg-forest text-white font-heading text-sm tracking-[0.1em] uppercase py-3.5 transition hover:bg-forest-deep hover:-translate-y-0.5 cursor-pointer",
  "package-gold":
    "block w-full text-center bg-gold text-forest font-heading text-sm tracking-[0.1em] uppercase py-3.5 transition hover:bg-gold-light hover:-translate-y-0.5 cursor-pointer",
};

export function BookingTrigger({
  bookingVariant = "session",
  packageInterest,
  styleVariant = "primary",
  className,
  children,
  ...props
}: BookingTriggerProps) {
  const { open } = useBookingModal();
  return (
    <button
      type="button"
      className={cn(variantStyles[styleVariant], className)}
      onClick={() => open(bookingVariant, { packageInterest })}
      {...props}
    >
      {children}
    </button>
  );
}
