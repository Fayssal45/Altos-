"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText, Users, Briefcase, Bell, TrendingUp, Eye,
  Euro, Settings, ChevronRight, Calendar,
  AlertCircle, BarChart3, Clock, Zap,
  TrendingDown, Send, Percent, ChevronDown
} from "lucide-react";
import { useDashboardMetrics } from "@/hooks/useBusiness";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG, JOB_STATUS_CONFIG } from "@/lib/utils";
import type { Business, Estimate, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

type RecentEstimate = Pick<Estimate, "id" | "number" | "title" | "status" | "total_amount_ht" | "vat_rate" | "created_at"> & {
  client: { full_name: string } | null;
};

type UpcomingJob = Pick<Job, "id" | "title" | "status" | "scheduled_date"> & {
  client: { full_name: string } | null;
};

type UnpaidEstimate = Pick<Estimate, "id" | "number" | "title" | "total_amount_ht" | "vat_rate" | "signed_at"> & {
  client: { full_name: string; phone: string | null } | null;
};

interface DashboardProps {
  business: Business | null;
  recentEstimates: RecentEstimate[];
  upcomingJobs: UpcomingJob[];
  unpaidEstimates: UnpaidEstimate[];
  clientsCount: number;
}

const GRID_TILES = [
  { href: "/clients",   label: "Clients",   icon: Users,      bg: "bg-emerald-500", shadow: "shadow-emerald-500/30" },
  { href: "/devis",     label: "Devis",     icon: FileText,   bg: "bg-blue-500",    shadow: "shadow-blue-500/30" },
  { href: "/planning",  label: "Planning",  icon: Calendar,   bg: "bg-violet-500",  shadow: "shadow-violet-500/30" },
  { href: "/relances",  label: "Relances",  icon: Bell,       bg: "bg-orange-500",  shadow: "shadow-orange-500/30" },
  { href: "/chantiers", label: "Chantiers", icon: Briefcase,  bg: "bg-slate-700",   shadow: "shadow-slate-700/30" },
  { href: "/revenus",   label: "Revenus",   icon: TrendingUp, bg: "bg-rose-500",    shadow: "shadow-rose-500/30" },
];

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function pct(a: number, b: number) {
  if (!b) return null;
  const diff = ((a - b) / b) * 100;
  return diff;
}

export default function Dashboard({ business, recentEstimates, upcomingJobs, unpaidEstimates, clientsCount }: DashboardProps) {
  const { data: metrics, isLoading } = useDashboardMetrics(business?.id);
  const [advanced, setAdvanced] = useState(false);

  const revenueChange = metrics ? pct(metrics.monthRevenue, metrics.prevMonthRevenue) : null;
  const conversionRate = metrics && metrics.sentCount > 0
    ? Math.round((metrics.acceptedCount / metrics.sentCount) * 100)
    : null;

  return (
    <div className="px-4 py-5 flex flex-col gap-4">

      {/* Greeting */}
      <div>
        <p className="text-slate-500 text-sm">{greetingText()} 👋</p>
        <h1 className="text-2xl font-black text-slate-900 leading-tight mt-0.5">
          {business?.name || "Mon Entreprise"}
        </h1>
        {business?.activity && (
          <p className="text-xs text-blue-600 font-semibold mt-0.5 uppercase tracking-wider">{business.activity}</p>
        )}
      </div>

      {/* Onboarding alert */}
      {!business && (
        <Link href="/profil/entreprise" className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-900">Configurez votre entreprise</p>
            <p className="text-xs text-blue-600">Nom, TVA, IBAN… (2 min)</p>
          </div>
          <ChevronRight className="w-4 h-4 text-blue-400" />
        </Link>
      )}

      {/* Alert: devis vus sans réponse */}
      {(metrics?.viewedNotSigned || 0) > 0 && (
        <Link href="/relances" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Eye className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              {metrics!.viewedNotSigned} devis consulté{metrics!.viewedNotSigned > 1 ? "s" : ""} sans réponse
            </p>
            <p className="text-xs text-amber-600">Relancer par WhatsApp →</p>
          </div>
        </Link>
      )}

      {/* 6 action tiles */}
      <div className="grid grid-cols-3 gap-2.5">
        {GRID_TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3.5 px-2 shadow-md text-white",
              "active:scale-95 transition-transform touch-manipulation select-none",
              tile.bg, tile.shadow
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <tile.icon className="w-4.5 h-4.5 text-white" strokeWidth={2} />
            </div>
            <p className="text-[11px] font-bold leading-none tracking-wide">{tile.label}</p>
          </Link>
        ))}
      </div>

      {/* RÉSUMÉ RAPIDE */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Résumé rapide</span>
          </div>
          {/* Advanced mode toggle */}
          <button
            onClick={() => setAdvanced(v => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors",
              advanced
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-500"
            )}
          >
            <Zap className="w-3 h-3" />
            Mode avancé
            <ChevronDown className={cn("w-3 h-3 transition-transform", advanced && "rotate-180")} />
          </button>
        </div>

        {/* CA compact row */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <Link href="/revenus" className="bg-blue-600 rounded-2xl p-3.5 shadow-md shadow-blue-600/20 flex flex-col gap-0.5">
            <p className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider">CA ce mois</p>
            <p className="text-white text-xl font-black tabular-nums leading-tight">
              {isLoading ? "…" : formatCurrency(metrics?.monthRevenue || 0)}
            </p>
            {revenueChange !== null && (
              <div className={cn("flex items-center gap-0.5 text-[10px] font-semibold", revenueChange >= 0 ? "text-blue-200" : "text-red-300")}>
                {revenueChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(0)}% vs mois dernier
              </div>
            )}
          </Link>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 flex flex-col gap-0.5">
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Chantiers actifs</p>
            <p className="text-violet-600 text-xl font-black tabular-nums leading-tight">
              {isLoading ? "…" : metrics?.activeJobs || 0}
            </p>
            <p className="text-slate-400 text-[10px]">{metrics?.pendingCount || 0} devis en attente</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 flex flex-col gap-0.5">
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Clients</p>
            <p className="text-emerald-600 text-xl font-black tabular-nums leading-tight">{clientsCount}</p>
            <p className="text-slate-400 text-[10px]">Dans le CRM</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 flex flex-col gap-0.5">
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Relances</p>
            <p className="text-orange-500 text-xl font-black tabular-nums leading-tight">
              {isLoading ? "…" : metrics?.pendingReminders || 0}
            </p>
            <p className="text-slate-400 text-[10px]">À envoyer</p>
          </div>
        </div>

        {/* Advanced mode extra metrics */}
        {advanced && (
          <div className="mt-2.5 flex flex-col gap-2.5 animate-slide-up">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-sm font-black text-slate-900 tabular-nums">
                  {isLoading ? "…" : formatCurrency(metrics?.prevMonthRevenue || 0)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">CA mois<br/>précédent</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-sm font-black text-blue-600 tabular-nums">
                  {isLoading ? "…" : metrics?.sentCount || 0}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">Devis<br/>envoyés</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
                  <Percent className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <p className="text-sm font-black text-emerald-600 tabular-nums">
                  {isLoading ? "…" : conversionRate !== null ? `${conversionRate}%` : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">Taux de<br/>conversion</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* À encaisser */}
      {unpaidEstimates.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              À encaisser
            </h2>
            <Link href="/devis" className="text-xs text-blue-600 font-semibold">Voir tout</Link>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
            {unpaidEstimates.map((e, i) => {
              const ttc = (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100);
              return (
                <Link
                  key={e.id}
                  href={`/devis/${e.id}/edit`}
                  className={cn("flex items-center gap-3 px-4 py-3 active:bg-slate-50", i < unpaidEstimates.length - 1 && "border-b border-slate-50")}
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Euro className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{e.title || e.number}</p>
                    <p className="text-xs text-slate-400 truncate">{e.client?.full_name}</p>
                  </div>
                  <span className="text-sm font-black text-amber-600 tabular-nums flex-shrink-0">{formatCurrency(ttc)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Prochains RDV */}
      {upcomingJobs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-violet-500" />
              Prochains RDV
            </h2>
            <Link href="/planning" className="text-xs text-blue-600 font-semibold">Planning →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {upcomingJobs.map((job, i) => (
              <Link
                key={job.id}
                href={`/chantiers/${job.id}`}
                className={cn("flex items-center gap-3 px-4 py-3 active:bg-slate-50", i < upcomingJobs.length - 1 && "border-b border-slate-50")}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  job.status === "in_progress" ? "bg-amber-100" : "bg-blue-50"
                )}>
                  <Briefcase className={cn("w-4 h-4", job.status === "in_progress" ? "text-amber-600" : "text-blue-600")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{job.title}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {job.client?.full_name}{job.scheduled_date && ` · ${formatDate(job.scheduled_date)}`}
                  </p>
                </div>
                <span className={cn("text-xs font-semibold rounded-full px-2 py-0.5 flex-shrink-0", JOB_STATUS_CONFIG[job.status].color)}>
                  {JOB_STATUS_CONFIG[job.status].label}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Activité récente */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            Activité récente
          </h2>
          <Link href="/devis" className="text-xs text-blue-600 font-semibold">Voir tout</Link>
        </div>

        {recentEstimates.length === 0 ? (
          <Link
            href="/devis/nouveau"
            className="flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Créez votre premier devis</p>
              <p className="text-xs text-slate-400 mt-1">Appuyez ici ou sur le bouton + ci-dessous</p>
            </div>
          </Link>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {recentEstimates.map((e, i) => {
              const cfg = ESTIMATE_STATUS_CONFIG[e.status];
              const ttc = (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100);
              return (
                <Link
                  key={e.id}
                  href={`/devis/${e.id}/edit`}
                  className={cn("flex items-center gap-3 px-4 py-3 active:bg-slate-50", i < recentEstimates.length - 1 && "border-b border-slate-50")}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{e.title || e.number || "Sans titre"}</p>
                    <p className="text-xs text-slate-400 truncate">{e.client?.full_name} · {formatDate(e.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", cfg.color)}>{cfg.label}</span>
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{formatCurrency(ttc)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="h-6" />
    </div>
  );
}
