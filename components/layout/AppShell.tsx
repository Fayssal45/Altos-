"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Business } from "@/lib/types";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard, FileText, Users, Briefcase, Bell,
  Plus, Camera, X
} from "lucide-react";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Accueil" },
  { href: "/devis", icon: FileText, label: "Devis" },
  { href: "/clients", icon: Users, label: "Clients" },
  { href: "/chantiers", icon: Briefcase, label: "Chantiers" },
  { href: "/relances", icon: Bell, label: "Relances" },
];

interface AppShellProps {
  children: React.ReactNode;
  business: Business | null;
  user: User;
}

export default function AppShell({ children, business, user }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [fabOpen, setFabOpen] = useState(false);

  const fabActions = [
    {
      label: "Nouveau Devis",
      icon: FileText,
      color: "bg-blue-600",
      action: () => { router.push("/devis/nouveau"); setFabOpen(false); },
    },
    {
      label: "Nouveau Client",
      icon: Users,
      color: "bg-emerald-600",
      action: () => { router.push("/clients/nouveau"); setFabOpen(false); },
    },
    {
      label: "Prendre Photo",
      icon: Camera,
      color: "bg-purple-600",
      action: () => { router.push("/chantiers/photo"); setFabOpen(false); },
    },
  ];

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 pt-safe">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">A</span>
            </div>
            <div>
              <p className="text-xs text-slate-400 leading-none">Tableau de bord</p>
              <p className="text-sm font-bold text-slate-900 leading-tight">
                {business?.name || "Mon Entreprise"}
              </p>
            </div>
          </div>
          <Link
            href="/profil"
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm"
          >
            {(business?.name || user.email || "U")[0].toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {/* FAB Overlay */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* FAB Actions */}
      {fabOpen && (
        <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3 items-end animate-slide-up">
          {fabActions.map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              className="flex items-center gap-3 group"
            >
              <span className="bg-white rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-lg">
                {action.label}
              </span>
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                action.color
              )}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 bg-white border-t border-slate-100 pb-safe">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all",
                  isActive ? "text-blue-600" : "text-slate-400"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}

          {/* FAB */}
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className={cn(
              "w-14 h-14 -mt-6 rounded-2xl flex items-center justify-center shadow-xl transition-all",
              fabOpen
                ? "bg-slate-800 rotate-45"
                : "bg-blue-600 shadow-blue-600/40"
            )}
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
      </nav>
    </div>
  );
}
