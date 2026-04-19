"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export type AppMode = "terrain" | "admin";

const STORAGE_KEY = "altos-mode";

// Tab roots that trigger auto-switch when navigated to directly.
// /terrain is the shared home — stays neutral so both modes can use it.
const TERRAIN_PATHS = new Set(["/planning", "/catalogue"]);
const ADMIN_PATHS   = new Set(["/dashboard", "/revenus"]);

interface AppModeContextValue {
  mode: AppMode;
  switchMode: (m: AppMode) => void;
  hydrated: boolean;
}

const AppModeContext = createContext<AppModeContextValue>({
  mode: "terrain",
  switchMode: () => {},
  hydrated: false,
});

// ── Provider ──────────────────────────────────────────────────────────────────
// Single source of truth. Wrap the app shell with this so all consumers
// share one React state and updates propagate instantly.

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<AppMode>("terrain");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on first render (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as AppMode | null;
      if (stored === "terrain" || stored === "admin") setMode(stored);
    } catch {}
    setHydrated(true);
  }, []);

  // Auto-switch when landing on a mode-specific tab root
  useEffect(() => {
    if (!hydrated) return;
    if (TERRAIN_PATHS.has(pathname)) {
      setMode("terrain");
      try { localStorage.setItem(STORAGE_KEY, "terrain"); } catch {}
    } else if (ADMIN_PATHS.has(pathname)) {
      setMode("admin");
      try { localStorage.setItem(STORAGE_KEY, "admin"); } catch {}
    }
    // neutral paths (/terrain, /devis, /clients, …) → keep current mode
  }, [pathname, hydrated]);

  const switchMode = (newMode: AppMode) => {
    setMode(newMode);
    try { localStorage.setItem(STORAGE_KEY, newMode); } catch {}
  };

  return (
    <AppModeContext.Provider value={{ mode, switchMode, hydrated }}>
      {children}
    </AppModeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
// All components call this — no pathname arg needed, no duplicate state.

export function useAppMode() {
  return useContext(AppModeContext);
}
