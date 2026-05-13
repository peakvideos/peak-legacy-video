import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Peak Studios CO",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }
  if (session.user.role !== "admin") {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="bg-forest text-white border-b-2 border-gold">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <Link
              href="/admin"
              className="font-heading text-xs uppercase tracking-[0.18em] text-gold"
            >
              Peak Studios CO &middot; Admin
            </Link>
            <AdminNav />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-sky hidden sm:inline">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <Toaster richColors closeButton position="bottom-right" />
    </div>
  );
}
