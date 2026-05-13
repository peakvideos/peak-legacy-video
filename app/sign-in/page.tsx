"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/admin",
    });
    if (error) {
      setError(error.message ?? "Sign-in failed.");
      setPending(false);
    } else {
      window.location.href = "/admin";
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-forest-deep px-6">
      <div className="w-full max-w-sm bg-white border-t-4 border-gold p-8 sm:p-10">
        <p className="font-heading text-xs uppercase tracking-[0.22em] text-gold mb-3">
          Peak Studios CO
        </p>
        <h1 className="text-forest text-2xl mb-2">Owner sign-in</h1>
        <p className="text-tofino italic text-sm mb-8">
          Sign in with your dashboard credentials.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            autoComplete="email"
            className="w-full px-3 py-2 border border-forest/18 text-sm focus:outline-none focus:border-gold"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-forest/18 text-sm focus:outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-forest text-white font-heading text-sm tracking-[0.1em] uppercase px-6 py-3 transition hover:bg-forest-deep cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </div>
    </main>
  );
}
