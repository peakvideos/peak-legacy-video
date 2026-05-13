"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root error]", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-forest-deep px-6 text-center">
      <div className="max-w-md">
        <p className="font-heading text-xs uppercase tracking-[0.22em] text-gold mb-3">
          Peak Studios CO
        </p>
        <h1 className="text-white text-4xl mb-3">Something went wrong.</h1>
        <p className="text-sky italic mb-8">
          We hit a snag loading this page. Please try again — and if it keeps
          happening, email us at{" "}
          <a href="mailto:peaklegacyvideos@gmail.com" className="underline text-gold">
            peaklegacyvideos@gmail.com
          </a>
          .
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-block bg-gold text-forest font-heading text-sm tracking-[0.1em] uppercase px-7 py-3 transition hover:bg-gold-light cursor-pointer"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
