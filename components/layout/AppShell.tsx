"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Business } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import {
  Home, FileText, Users, Calendar, Bell,
  Plus, X, Zap, Briefcase
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home,     label: "Accueil" },
  { href: "/devis",     icon: FileText, label: "Devis" },
  { href: "/clients",   icon: Users,    label: "Clients" },
  { href: "/planning",  icon: Calendar, label: "Planning" },
  { href: "/relances",  icon: Bell,     label: "Relances" },
];

const FAB_ACTIONS = [
  {
    label: "Intervention rapide",
    icon: Zap,
    color: "bg-amber-500",
    shadow: "shadow-amber-500/40",
    href: "/interventions/nouveau",
  },
  {
    label: "Nouveau Devis",
    icon: FileText,
    color: "bg-blue-600",
    shadow: "shadow-blue-600/40",
    href: "/devis/nouveau",
  },
  {
    label: "Nouveau Client",
    icon: Users,
    color: "bg-emerald-600",
    shadow: "shadow-emerald-600/40",
    href: "/clients/nouveau",
  },
  {
    label: "Nouveau Chantier",
    icon: Briefcase,
    color: "bg-violet-600",
    shadow: "shadow-violet-600/40",
    href: "/chantiers/nouveau",
  },
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

  const initial = (business?.name || user.email || "U")[0].toUpperCase();

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto bg-slate-50">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 leading-none">
                {business?.name || "Altos"}
              </p>
              {business?.activity && (
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">{business.activity}</p>
              )}
            </div>
          </Link>
          <Link
            href="/profil"
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm"
          >
            {initial}
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {/* FAB overlay */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* FAB actions — slide up depuis le bouton */}
      {fabOpen && (
        <div className="fixed bottom-[88px] right-4 z-50 flex flex-col gap-2.5 items-end">
          {FAB_ACTIONS.map((action, i) => (
            <button
              key={i}
              onClick={() => { router.push(action.href); setFabOpen(false); }}
              className="flex items-center gap-3 animate-slide-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="bg-white rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-lg border border-slate-100">
                {action.label}
              </span>
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0",
                action.color, action.shadow
              )}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 bg-white border-t border-slate-100 pb-safe">
        <div className="flex items-center px-1 py-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors",
                  isActive ? "text-blue-600" : "text-slate-400"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-all", isActive ? "stroke-[2.5]" : "stroke-2")} />
                <span className="text-[9px] font-bold tracking-wide">{item.label}</span>
              </Link>
            );
          })}

          {/* FAB central */}
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className={cn(
              "w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-200 flex-shrink-0 mx-1",
              fabOpen ? "bg-slate-800" : "bg-blue-600 shadow-blue-600/40"
            )}
            aria-label="Actions rapides"
          >
            <Plus className={cn("w-6 h-6 text-white transition-transform duration-200", fabOpen && "rotate-45")} />
          </button>
        </div>
      </nav>
    </div>
  );
}
