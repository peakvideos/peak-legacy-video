"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin error]", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="font-heading text-forest text-2xl mb-3">
        Something broke in the dashboard.
      </h1>
      <p className="text-tofino italic mb-2">
        {error.message || "Unexpected error."}
      </p>
      {error.digest && (
        <p className="text-xs text-tofino/70 mb-6">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="bg-forest text-white font-heading text-xs tracking-[0.1em] uppercase px-5 py-2.5 transition hover:bg-forest-deep cursor-pointer"
      >
        Try again
      </button>
    </main>
  );
}
