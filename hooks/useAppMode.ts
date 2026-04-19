"use client";

import { useState, useEffect } from "react";

export type AppMode = "terrain" | "admin";

const STORAGE_KEY = "altos-mode";

// Tab roots that trigger auto-switch when navigated to directly.
// Sub-routes (e.g. /devis/nouveau) never auto-switch — user keeps current mode.
// /terrain is NEUTRAL — it is the shared home for both modes.
const TERRAIN_PATHS = new Set(["/planning", "/catalogue"]);
const ADMIN_PATHS   = new Set(["/dashboard", "/revenus"]);
// Neutral (no auto-switch): /devis, /clients, /relances, /profil, /documents, /chantiers

export function useAppMode(pathname: string) {
  const [mode, setMode] = useState<AppMode>("terrain");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as AppMode | null;
      if (stored === "terrain" || stored === "admin") setMode(stored);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (TERRAIN_PATHS.has(pathname)) {
      setMode("terrain");
      try { localStorage.setItem(STORAGE_KEY, "terrain"); } catch {}
    } else if (ADMIN_PATHS.has(pathname)) {
      setMode("admin");
      try { localStorage.setItem(STORAGE_KEY, "admin"); } catch {}
    }
  }, [pathname, hydrated]);

  const switchMode = (newMode: AppMode) => {
    setMode(newMode);
    try { localStorage.setItem(STORAGE_KEY, newMode); } catch {}
  };

  return { mode, switchMode, hydrated };
}
