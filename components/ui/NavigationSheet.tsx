"use client";

import { X, Navigation } from "lucide-react";

interface NavigationSheetProps {
  address: string;
  onClose: () => void;
}

const encoded = (a: string) => encodeURIComponent(a);

const NAV_APPS = [
  {
    name: "Google Maps",
    href: (a: string) => `https://www.google.com/maps/dir/?api=1&destination=${encoded(a)}`,
    bg: "bg-white border border-slate-200",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    label: "text-slate-900",
  },
  {
    name: "Apple Plans",
    href: (a: string) => `https://maps.apple.com/?daddr=${encoded(a)}`,
    bg: "bg-white border border-slate-200",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-600",
    label: "text-slate-900",
  },
  {
    name: "Waze",
    href: (a: string) => `https://waze.com/ul?q=${encoded(a)}`,
    bg: "bg-white border border-slate-200",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-500",
    label: "text-slate-900",
  },
];

export default function NavigationSheet({ address, onClose }: NavigationSheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-white rounded-t-3xl shadow-2xl">
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
          <div>
            <p className="text-sm font-black text-slate-900">Ouvrir l'itinéraire</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px]">{address}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-2">
          {NAV_APPS.map((app) => (
            <a
              key={app.name}
              href={app.href(address)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl active:opacity-70 transition-opacity ${app.bg}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${app.iconBg}`}>
                <Navigation className={`w-5 h-5 ${app.iconColor}`} />
              </div>
              <span className={`text-sm font-semibold ${app.label}`}>{app.name}</span>
            </a>
          ))}

          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 active:bg-slate-200 mt-1"
          >
            <X className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-500">Annuler</span>
          </button>
        </div>

        <div className="pb-safe h-3" />
      </div>
    </>
  );
}
