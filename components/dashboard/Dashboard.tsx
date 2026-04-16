"use client";

import Link from "next/link";
import { FileText, Users, Briefcase, Bell, Settings, TrendingUp, Eye, Clock, Euro } from "lucide-react";
import { useDashboardMetrics } from "@/hooks/useBusiness";
import { formatCurrency } from "@/lib/utils";
import type { Business } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DashboardProps {
  business: Business | null;
}

// Les 6 gros boutons de navigation – inspirés de l'image
const GRID_TILES = [
  {
    href: "/devis/nouveau",
    label: "Nouveau Devis",
    icon: FileText,
    bg: "bg-blue-500",
    shadow: "shadow-blue-500/30",
    description: "En 2 min",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
    bg: "bg-emerald-500",
    shadow: "shadow-emerald-500/30",
    description: "Répertoire",
  },
  {
    href: "/devis",
    label: "Planning",
    icon: Clock,
    bg: "bg-amber-500",
    shadow: "shadow-amber-500/30",
    description: "Devis en cours",
  },
  {
    href: "/relances",
    label: "Relances",
    icon: Bell,
    bg: "bg-orange-500",
    shadow: "shadow-orange-500/30",
    description: "Automatiques",
  },
  {
    href: "/chantiers",
    label: "Chantiers",
    icon: Briefcase,
    bg: "bg-violet-500",
    shadow: "shadow-violet-500/30",
    description: "Suivi terrain",
  },
  {
    href: "/revenus",
    label: "Revenus",
    icon: TrendingUp,
    bg: "bg-rose-500",
    shadow: "shadow-rose-500/30",
    description: "Ce mois",
  },
];

export default function Dashboard({ business }: DashboardProps) {
  const { data: metrics, isLoading } = useDashboardMetrics(business?.id);

  const METRIC_CARDS = [
    {
      label: "Devis en attente",
      value: isLoading ? "…" : formatCurrency(metrics?.pendingEstimatesAmount || 0),
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      sub: `${metrics?.pendingCount || 0} devis`,
    },
    {
      label: "Relances",
      value: isLoading ? "…" : String(metrics?.pendingReminders || 0),
      icon: Bell,
      color: "text-orange-600",
      bg: "bg-orange-50",
      sub: metrics?.viewedNotSigned ? `${metrics.viewedNotSigned} consultés` : "À jour",
    },
    {
      label: "Chantiers",
      value: isLoading ? "…" : String(metrics?.activeJobs || 0),
      icon: Briefcase,
      color: "text-violet-600",
      bg: "bg-violet-50",
      sub: "En cours",
    },
    {
      label: "Revenus",
      value: isLoading ? "…" : formatCurrency(metrics?.monthRevenue || 0),
      icon: Euro,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      sub: "Ce mois (TTC)",
    },
  ];

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-black text-slate-900">
          Bonjour 👋
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {business?.name || "Bienvenue sur Altos"}
          {business?.activity && (
            <span className="ml-1 text-slate-400">· {business.activity}</span>
          )}
        </p>
      </div>

      {/* Alert: devis vus non signés */}
      {(metrics?.viewedNotSigned || 0) > 0 && (
        <Link href="/relances" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 active:scale-98 transition-transform">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Eye className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {metrics!.viewedNotSigned} devis consulté{metrics!.viewedNotSigned > 1 ? "s" : ""} sans réponse
            </p>
            <p className="text-xs text-amber-600">Relancer maintenant →</p>
          </div>
        </Link>
      )}

      {/* Grille 2×3 des 6 gros boutons */}
      <div className="grid grid-cols-2 gap-3">
        {GRID_TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-2xl p-5 shadow-lg text-white",
              "active:scale-95 transition-transform touch-manipulation select-none",
              tile.bg,
              tile.shadow
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <tile.icon className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold leading-tight">{tile.label}</p>
              <p className="text-[11px] text-white/70 mt-0.5">{tile.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Résumé Rapide – 4 métriques */}
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          Résumé Rapide
        </h3>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {METRIC_CARDS.map((metric, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5",
                i < METRIC_CARDS.length - 1 && "border-b border-slate-50"
              )}
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", metric.bg)}>
                <metric.icon className={cn("w-5 h-5", metric.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 font-medium">{metric.label}</p>
                <p className="text-xs text-slate-400">{metric.sub}</p>
              </div>
              <span className={cn("text-lg font-black tabular-nums", metric.color)}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Setup rapide si pas encore de business configuré */}
      {!business && (
        <Link
          href="/profil/entreprise"
          className="flex items-center gap-3 bg-blue-600 rounded-2xl p-4 text-white active:scale-98 transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">Configurer mon entreprise</p>
            <p className="text-xs text-blue-200">Nom, logo, IBAN… (2 min)</p>
          </div>
        </Link>
      )}

      {/* Spacer pour le FAB */}
      <div className="h-4" />
    </div>
  );
}
