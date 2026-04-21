"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export type AppMode = "terrain" | "admin" | "commercial";

const STORAGE_KEY = "altos-mode";

// Paths that auto-switch the mode when navigated to directly.
const TERRAIN_PATHS  = new Set(["/planning", "/catalogue"]);
const ADMIN_PATHS    = new Set(["/dashboard", "/revenus"]);
// /commercial and all its children → commercial mode

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

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode]       = useState<AppMode>("terrain");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as AppMode | null;
      if (stored === "terrain" || stored === "admin" || stored === "commercial") {
        setMode(stored);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Auto-switch on direct navigation to a mode-specific path
  useEffect(() => {
    if (!hydrated) return;
    const isCommercial = pathname === "/commercial" || pathname.startsWith("/commercial/");
    if (isCommercial) {
      persist("commercial");
    } else if (TERRAIN_PATHS.has(pathname)) {
      persist("terrain");
    } else if (ADMIN_PATHS.has(pathname)) {
      persist("admin");
    }
    // neutral paths (/terrain, /devis, /clients…) → keep current mode
  }, [pathname, hydrated]);

  const persist = (m: AppMode) => {
    setMode(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
  };

  const switchMode = (newMode: AppMode) => persist(newMode);

  return (
    <AppModeContext.Provider value={{ mode, switchMode, hydrated }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
