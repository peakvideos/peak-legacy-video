import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminThemeProvider } from "@/components/admin/admin-theme";
import { ADMIN_THEME_COOKIE, type Theme } from "@/lib/admin/theme";
import { AdminToaster } from "@/components/admin/admin-toaster";
import { loadSidebarCounts } from "@/lib/admin/sidebar-counts";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileSidebarTrigger } from "@/components/admin/mobile-sidebar-trigger";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Peak Studios CO",
  robots: { index: false, follow: false, nocache: true },
};

const SIDEBAR_COOKIE = "sidebar_state";

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

  const counts = await loadSidebarCounts();

  const cookieStore = await cookies();
  const storedTheme = cookieStore.get(ADMIN_THEME_COOKIE)?.value;
  const initialTheme: Theme = storedTheme === "dark" ? "dark" : "light";
  const sidebarOpen = cookieStore.get(SIDEBAR_COOKIE)?.value !== "false";

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[admin-theme] cookie read: "${storedTheme ?? "(none)"}" → initialTheme=${initialTheme}`,
    );
  }

  return (
    <AdminThemeProvider
      initialTheme={initialTheme}
      className="h-screen overflow-hidden bg-(--adm-page)"
    >
      <TooltipProvider delayDuration={300}>
        <SidebarProvider defaultOpen={sidebarOpen} className="h-screen">
          <AdminSidebar counts={counts} userEmail={session.user.email ?? ""} />
          <SidebarInset className="bg-(--adm-page) min-h-0 min-w-0">
            <MobileSidebarTrigger />
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
      <AdminToaster />
    </AdminThemeProvider>
  );
}
