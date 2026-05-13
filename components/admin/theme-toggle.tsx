"use client";

import { Moon, Sun } from "lucide-react";
import { useAdminTheme } from "./admin-theme";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function ThemeToggle() {
  const { theme, toggle } = useAdminTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;

  return (
    <SidebarMenuButton
      onClick={toggle}
      aria-label={label}
      tooltip={label}
      className="text-(--adm-text-muted) hover:text-(--adm-text)"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </SidebarMenuButton>
  );
}
