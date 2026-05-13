"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { setAdminTheme } from "@/app/admin/theme-actions";
import type { Theme } from "@/lib/admin/theme";

export type { Theme };

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Admin-scoped dark mode. Initial theme comes from the cookie (read server-
 * side in the layout) so SSR renders with the correct class — no light-mode
 * flash. The `dark` class is applied to this wrapper, not <html>, so the
 * landing page never inherits it.
 *
 * Cookie persistence runs through a server action (`setAdminTheme`) rather
 * than `document.cookie`. Client-side cookie writes get blocked or silently
 * scoped wrong in several real-world cases (extensions, Safari ITP, certain
 * dev tunnels), and Set-Cookie via a server action sidesteps all of them.
 */
export function AdminThemeProvider({
  children,
  className,
  initialTheme,
}: {
  children: React.ReactNode;
  className?: string;
  initialTheme: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Skip the very first effect run — initialTheme already matches the cookie
  // by definition, so there's nothing to persist. After that, any user-
  // initiated change syncs to the server.
  const isFirstSync = useRef(true);
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    void setAdminTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      <div className={cn("admin-shell", theme === "dark" && "dark", className)}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useAdminTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAdminTheme must be used inside AdminThemeProvider");
  }
  return ctx;
}

/**
 * Like `useAdminTheme` but returns null instead of throwing when called
 * outside the admin shell. Used by shared primitives (e.g. the shadcn
 * Sidebar's mobile sheet) that need to opt into the admin theme when
 * available without forcing every consumer into the admin tree.
 */
export function useAdminThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
