"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              window.location.href = "/sign-in";
            },
          },
        });
      }}
      className="font-heading text-xs tracking-[0.1em] uppercase text-sky hover:text-gold transition cursor-pointer disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
