"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirects to the mode home on first load.
// terrain → /planning, admin → /dashboard (default)
export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    try {
      const mode = localStorage.getItem("altos-mode");
      router.replace("/terrain"); // shared home for both modes
    } catch {
      router.replace("/planning");
    }
  }, [router]);
  return null;
}
