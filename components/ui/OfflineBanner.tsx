"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Initial state
    setOffline(!navigator.onLine);

    const onOffline = () => setOffline(true);
    const onOnline  = () => setOffline(false);

    window.addEventListener("offline", onOffline);
    window.addEventListener("online",  onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online",  onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner flex items-center justify-center gap-2 fixed top-0 left-0 right-0 z-[200]">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Hors connexion — les données seront synchronisées dès le retour du réseau</span>
    </div>
  );
}
