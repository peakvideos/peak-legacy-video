"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Leads" },
  { href: "/admin/sequences", label: "Sequences" },
  { href: "/admin/settings/templates", label: "Templates" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin" ||
              pathname.startsWith("/admin/leads/")
            : pathname === link.href ||
              pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "font-heading text-xs uppercase tracking-[0.12em] px-3 py-1.5",
              active
                ? "text-gold border-b-2 border-gold"
                : "text-sky/80 hover:text-gold border-b-2 border-transparent",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
