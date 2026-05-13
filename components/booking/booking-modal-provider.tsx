"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { BookingModal } from "./booking-modal";
import type { PackageInterest } from "./schemas";

export type BookingVariant = "session" | "questions";

type OpenOptions = {
  packageInterest?: PackageInterest;
};

type BookingModalContextValue = {
  open: (variant?: BookingVariant, options?: OpenOptions) => void;
  close: () => void;
};

const BookingModalContext = createContext<BookingModalContextValue | null>(null);

export function BookingModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [variant, setVariant] = useState<BookingVariant>("session");
  const [initialPackage, setInitialPackage] = useState<PackageInterest | undefined>(undefined);

  const open = useCallback<BookingModalContextValue["open"]>((nextVariant = "session", options) => {
    setVariant(nextVariant);
    setInitialPackage(options?.packageInterest);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <BookingModalContext.Provider value={{ open, close }}>
      {children}
      <BookingModal
        open={isOpen}
        onOpenChange={setIsOpen}
        variant={variant}
        initialPackage={initialPackage}
      />
    </BookingModalContext.Provider>
  );
}

export function useBookingModal() {
  const ctx = useContext(BookingModalContext);
  if (!ctx) {
    throw new Error("useBookingModal must be used inside <BookingModalProvider>");
  }
  return ctx;
}
