"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText, Users, Briefcase, Bell,
  Euro, Settings, ChevronRight, Calendar,
  Clock, TrendingUp, TrendingDown,
  Eye, ArrowRight, BarChart2,
  Phone, Navigation, Zap, MessageSquare,
} from "lucide-react";
import { useDashboardMetrics } from "@/hooks/useBusiness";
import {
  formatCurrency, formatDate, formatDuration,
  ESTIMATE_STATUS_CONFIG, JOB_STATUS_CONFIG,
} from "@/lib/utils";
import type { Business, Estimate, Job, Client } from "@/lib/types";
import { cn } from "@/lib/utils";
import NavigationSheet from "@/components/ui/NavigationSheet";
import MessageSheet from "@/components/ui/MessageSheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type TodayJob = Pick<Job, "id" | "title" | "status" | "scheduled_date" | "address" | "estimated_hours" | "notes"> & {
  client: Pick<Client, "id" | "full_name" | "phone"> & { address: string | null; city: string | null } | null;
  estimate: { id: string; number: string | null; total_amount_ht: number; vat_rate: number } | null;
};

type RecentEstimate = Pick<Estimate, "id" | "number" | "title" | "status" | "total_amount_ht" | "vat_rate" | "created_at"> & {
  client: { id: string; full_name: string; phone: string | null; city: string | null; address: string | null } | null;
};

type UpcomingJob = Pick<Job, "id" | "title" | "status" | "scheduled_date" | "address"> & {
  client: { id: string; full_name: string; phone: string | null; city: string | null; address: string | null } | null;
};

type UnpaidEstimate = Pick<Estimate, "id" | "number" | "title" | "total_amount_ht" | "vat_rate" | "signed_at"> & {
  client: { full_name: string; phone: string | null } | null;
};

interface DashboardProps {
  business: Business | null;
  todayJobs: TodayJob[];
  recentEstimates: RecentEstimate[];
  upcomingJobs: UpcomingJob[];
  unpaidEstimates: UnpaidEstimate[];
  clientsCount: number;
}

function pct(a: number, b: number) {
  if (!b) return null;
  return ((a - b) / b) * 100;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard({
  business, todayJobs, recentEstimates, upcomingJobs, unpaidEstimates, clientsCount,
}: DashboardProps) {
  const { data: metrics, isLoading } = useDashboardMetrics(business?.id);
  const revenueChange = metrics ? pct(metrics.monthRevenue, metrics.prevMonthRevenue) : null;
  const [advancedMode, setAdvancedMode] = useState(false);

  const conversionRate =
    metrics && metrics.sentCount > 0
      ? Math.round((metrics.acceptedCount / metrics.sentCount) * 100)
      : null;

  const today = new Date();
  const dateLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-0 pb-8">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4 bg-white border-b border-slate-100">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
          Tableau de bord
        </p>
        <h1 className="text-xl font-black text-slate-900">
          {business?.name || "Mon Entreprise"}
        </h1>
        {business?.activity && (
          <p className="text-sm text-slate-500 mt-0.5">{business.activity}</p>
        )}
      </div>

      {/* ── Alerte onboarding ────────────────────────────────────────────── */}
      {!business && (
        <div className="px-4 pt-4">
          <Link
            href="/profil/entreprise"
            className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4"
          >
            <Settings className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">Configurez votre entreprise</p>
              <p className="text-xs text-blue-600 mt-0.5">Nom, TVA, IBAN… (2 min)</p>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
          </Link>
        </div>
      )}

      {/* ── Intervention rapide (CTA principal) ─────────────────────────── */}
      <div className="px-4 pt-4">
        <Link href="/interventions/nouveau">
          <div className="flex items-center gap-4 bg-amber-500 rounded-2xl px-5 py-4 shadow-lg shadow-amber-500/30 active:scale-[0.98] transition-transform">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-base font-black text-white leading-tight">Intervention rapide</p>
              <p className="text-xs text-amber-100 mt-0.5">Créer + facturer en 30 secondes</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
          </div>
        </Link>
      </div>

      {/* ── Brief du jour ────────────────────────────────────────────────── */}
      <section className="px-4 pt-4">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <p className="text-base font-black text-slate-900 capitalize">{dateLabel}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {todayJobs.length === 0
                ? "Aucune intervention planifiée aujourd'hui"
                : `${todayJobs.length} intervention${todayJobs.length > 1 ? "s" : ""} prévue${todayJobs.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/planning">
            <span className="text-xs text-slate-400 font-medium">Planning →</span>
          </Link>
        </div>

        {todayJobs.length === 0 ? (
          <Link
            href="/chantiers/nouveau"
            className="flex items-center gap-3 bg-white border border-dashed border-slate-200 rounded-2xl px-4 py-4"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Planifier une journée</p>
              <p className="text-xs text-slate-400 mt-0.5">Ajouter une intervention pour aujourd'hui</p>
            </div>
          </Link>
        ) : (
          <div className="flex flex-col gap-3">
            {todayJobs.map((job) => (
              <TodayJobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      {/* ── Navigation principale (6 grandes tuiles) ────────────────────── */}
      <section className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: "/devis",     icon: FileText,  label: "Devis",      bg: "bg-blue-500",    shadow: "shadow-blue-500/30" },
            { href: "/clients",   icon: Users,     label: "Clients",    bg: "bg-emerald-500", shadow: "shadow-emerald-500/30" },
            { href: "/planning",  icon: Calendar,  label: "Planning",   bg: "bg-violet-500",  shadow: "shadow-violet-500/30" },
            { href: "/relances",  icon: Bell,      label: "Relances",   bg: "bg-orange-500",  shadow: "shadow-orange-500/30",
              badge: (metrics?.pendingReminders || 0) + (metrics?.viewedNotSigned || 0) || undefined },
            { href: "/chantiers", icon: Briefcase, label: "Interventions", bg: "bg-slate-700",   shadow: "shadow-slate-700/30" },
            { href: "/revenus",   icon: Euro,      label: "Revenus",    bg: "bg-rose-500",    shadow: "shadow-rose-500/30" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "relative rounded-2xl py-4 px-2 flex flex-col items-center gap-2 active:scale-95 transition-transform shadow-lg",
                item.bg, item.shadow
              )}>
                <item.icon className="w-7 h-7 text-white" />
                <p className="text-xs font-bold text-white text-center leading-tight">{item.label}</p>
                {"badge" in item && item.badge ? (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-black text-red-600">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Alertes prioritaires ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 flex flex-col gap-2">
        {(metrics?.viewedNotSigned || 0) > 0 && (
          <Link
            href="/relances"
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 active:bg-amber-100"
          >
            <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="flex-1 text-sm font-medium text-amber-900">
              {metrics!.viewedNotSigned} devis consulté{metrics!.viewedNotSigned > 1 ? "s" : ""} sans réponse
            </p>
            <span className="text-xs font-semibold text-amber-600">Relancer →</span>
          </Link>
        )}
        {(metrics?.pendingReminders || 0) > 0 && (
          <Link
            href="/relances"
            className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 active:bg-orange-100"
          >
            <Bell className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <p className="flex-1 text-sm font-medium text-orange-900">
              {metrics!.pendingReminders} relance{metrics!.pendingReminders > 1 ? "s" : ""} à envoyer
            </p>
            <span className="text-xs font-semibold text-orange-600">Voir →</span>
          </Link>
        )}
      </div>

      {/* ── Métriques clés ───────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <Link
            href="/revenus"
            className="flex items-center justify-between px-4 py-4 border-b border-slate-100 active:bg-slate-50"
          >
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Chiffre d'affaires — ce mois
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {isLoading ? "—" : formatCurrency(metrics?.monthRevenue || 0)}
              </p>
              {revenueChange !== null && (
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium mt-1",
                  revenueChange >= 0 ? "text-emerald-600" : "text-red-500"
                )}>
                  {revenueChange >= 0
                    ? <TrendingUp className="w-3.5 h-3.5" />
                    : <TrendingDown className="w-3.5 h-3.5" />}
                  {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(0)}% vs mois précédent
                </div>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
          </Link>

          <div className="grid grid-cols-3 divide-x divide-slate-100">
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 font-medium">Devis en attente</p>
              <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
                {isLoading ? "—" : metrics?.pendingCount || 0}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 font-medium">Interventions</p>
              <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
                {isLoading ? "—" : metrics?.activeJobs || 0}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 font-medium">Clients</p>
              <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
                {clientsCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── À encaisser ──────────────────────────────────────────────────── */}
      {unpaidEstimates.length > 0 && (
        <section className="px-4 pt-4">
          <SectionHeader
            icon={<Euro className="w-4 h-4 text-slate-500" />}
            label="À encaisser"
            href="/devis"
          />
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-2">
            {unpaidEstimates.map((e, i) => {
              const ttc = (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100);
              return (
                <Link
                  key={e.id}
                  href={`/devis/${e.id}/edit`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 active:bg-slate-50",
                    i < unpaidEstimates.length - 1 && "border-b border-slate-100"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{e.title || e.number}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {e.client?.full_name}
                      {e.signed_at && ` · signé le ${formatDate(e.signed_at)}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">
                    {formatCurrency(ttc)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Prochaine intervention ───────────────────────────────────────── */}
      {upcomingJobs.length > 0 && (
        <section className="px-4 pt-4">
          <SectionHeader
            icon={<Calendar className="w-4 h-4 text-slate-500" />}
            label="Prochaine intervention"
            href="/planning"
            linkLabel="Planning"
          />
          <NextInterventionCard job={upcomingJobs[0]} />

          {/* Remaining upcoming jobs (compact list) */}
          {upcomingJobs.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-2">
              {upcomingJobs.slice(1).map((job, i) => {
                const clientCity = job.client?.city;
                return (
                  <Link
                    key={job.id}
                    href={`/chantiers/${job.id}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 active:bg-slate-50",
                      i < upcomingJobs.length - 2 && "border-b border-slate-100"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{job.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {job.client?.full_name}
                        {clientCity && ` · ${clientCity}`}
                        {job.scheduled_date && ` · ${formatDate(job.scheduled_date)}`}
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs font-medium rounded-md px-2 py-1 flex-shrink-0",
                      JOB_STATUS_CONFIG[job.status].color
                    )}>
                      {JOB_STATUS_CONFIG[job.status].label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Activité récente ─────────────────────────────────────────────── */}
      <section className="px-4 pt-4">
        <SectionHeader
          icon={<Clock className="w-4 h-4 text-slate-500" />}
          label="Activité récente"
          href="/devis"
        />
        {recentEstimates.length === 0 ? (
          <Link
            href="/devis/nouveau"
            className="flex items-center gap-4 bg-white border border-dashed border-slate-300 rounded-xl px-4 py-5 mt-2 active:bg-slate-50"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Créez votre premier devis</p>
              <p className="text-xs text-slate-400 mt-0.5">Appuyez pour commencer</p>
            </div>
          </Link>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {recentEstimates.map((e) => (
              <RecentEstimateCard key={e.id} estimate={e} />
            ))}
          </div>
        )}
      </section>

      {/* ── Mode avancé ──────────────────────────────────────────────────── */}
      <section className="px-4 pt-4">
        <button
          onClick={() => setAdvancedMode(!advancedMode)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Mode avancé</span>
          </div>
          <span className={cn(
            "text-xs font-semibold px-2.5 py-1 rounded-full transition-colors",
            advancedMode ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
          )}>
            {advancedMode ? "Activé" : "Désactivé"}
          </span>
        </button>

        {advancedMode && (
          <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Ce mois-ci</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-slate-900 tabular-nums">{isLoading ? "—" : metrics?.sentCount || 0}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Envoyés</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-slate-900 tabular-nums">{isLoading ? "—" : metrics?.acceptedCount || 0}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Acceptés</p>
                </div>
                <div className={cn(
                  "rounded-xl p-3 text-center",
                  conversionRate !== null && conversionRate >= 50 ? "bg-emerald-50" :
                  conversionRate !== null && conversionRate >= 25 ? "bg-amber-50" : "bg-slate-50"
                )}>
                  <p className={cn(
                    "text-lg font-black tabular-nums",
                    conversionRate !== null && conversionRate >= 50 ? "text-emerald-700" :
                    conversionRate !== null && conversionRate >= 25 ? "text-amber-700" : "text-slate-900"
                  )}>
                    {isLoading ? "—" : conversionRate !== null ? `${conversionRate}%` : "–"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Conversion</p>
                </div>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Mois précédent</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Chiffre d'affaires</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {isLoading ? "—" : formatCurrency(metrics?.prevMonthRevenue || 0)}
                </span>
              </div>
              {revenueChange !== null && (
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium mt-1.5",
                  revenueChange >= 0 ? "text-emerald-600" : "text-red-500"
                )}>
                  {revenueChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(0)}% par rapport au mois dernier
                </div>
              )}
            </div>
          </div>
        )}
      </section>


    </div>
  );
}

// ─── Next Intervention Card ───────────────────────────────────────────────────

function NextInterventionCard({ job }: { job: UpcomingJob }) {
  const [navOpen, setNavOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const statusCfg = JOB_STATUS_CONFIG[job.status];
  const clientCity = job.client?.city;
  const jobAddress = job.address || job.client?.address;
  const displayAddress = [jobAddress, clientCity].filter(Boolean).join(", ");
  const phone = job.client?.phone?.replace(/[\s\-\.]/g, "").replace(/^0/, "+32") || null;

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mt-2">
        {/* Main info */}
        <Link href={`/chantiers/${job.id}`} className="block px-4 pt-4 pb-3 active:bg-slate-50">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-base font-black text-slate-900 leading-tight flex-1">{job.title}</p>
            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5", statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {job.client?.full_name && (
              <span className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                <Users className="w-3 h-3 text-slate-400" />
                {job.client.full_name}
              </span>
            )}
            {clientCity && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Navigation className="w-3 h-3 text-slate-400" />
                {clientCity}
              </span>
            )}
            {job.scheduled_date && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="w-3 h-3 text-slate-400" />
                {formatDate(job.scheduled_date)}
              </span>
            )}
          </div>
        </Link>

        {/* Quick actions */}
        <div className="border-t border-slate-100 flex divide-x divide-slate-100">
          {phone && (
            <a href={`tel:${phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-3 active:bg-slate-50">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Appeler</span>
            </a>
          )}
          {phone && (
            <button
              onClick={() => setMsgOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 active:bg-slate-50"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Message</span>
            </button>
          )}
          {displayAddress && (
            <button
              onClick={() => setNavOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 active:bg-slate-50"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center">
                <Navigation className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Itinéraire</span>
            </button>
          )}
          <Link
            href={`/chantiers/${job.id}`}
            className="flex items-center justify-center px-3 py-3 active:bg-slate-50"
          >
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        </div>
      </div>

      {navOpen && <NavigationSheet address={displayAddress} onClose={() => setNavOpen(false)} />}
      {msgOpen && phone && (
        <MessageSheet
          phone={phone}
          clientName={job.client?.full_name || ""}
          context={job.title}
          onClose={() => setMsgOpen(false)}
        />
      )}
    </>
  );
}

// ─── Recent Estimate Card (with quick actions) ────────────────────────────────

function RecentEstimateCard({ estimate: e }: { estimate: RecentEstimate }) {
  const [navOpen, setNavOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const cfg = ESTIMATE_STATUS_CONFIG[e.status];
  const ttc = (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100);
  const phone = e.client?.phone?.replace(/[\s\-\.]/g, "").replace(/^0/, "+32") || null;
  const city = e.client?.city;
  const address = e.client?.address;
  const locationStr = [address, city].filter(Boolean).join(", ");

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Main row */}
        <Link href={`/devis/${e.id}/edit`} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {e.title || e.number || "Sans titre"}
              </p>
              <span className={cn("text-[10px] font-semibold rounded px-1.5 py-0.5 flex-shrink-0", cfg.color)}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {e.client?.full_name}
              {city && ` · ${city}`}
              {` · ${formatDate(e.created_at)}`}
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-700 tabular-nums flex-shrink-0">
            {formatCurrency(ttc)}
          </span>
        </Link>

        {/* Quick actions — only if we have contact/location info */}
        {(phone || locationStr) && (
          <div className="border-t border-slate-50 flex divide-x divide-slate-100">
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-1.5 px-3 py-2.5 active:bg-slate-50">
                <Phone className="w-3 h-3 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-600">Appeler</span>
              </a>
            )}
            {phone && (
              <button
                onClick={() => setMsgOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 active:bg-slate-50"
              >
                <MessageSquare className="w-3 h-3 text-emerald-500" />
                <span className="text-[11px] font-semibold text-slate-600">Message</span>
              </button>
            )}
            {locationStr && (
              <button
                onClick={() => setNavOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 active:bg-slate-50"
              >
                <Navigation className="w-3 h-3 text-sky-500" />
                <span className="text-[11px] font-semibold text-slate-600">Itinéraire</span>
              </button>
            )}
          </div>
        )}
      </div>

      {navOpen && locationStr && (
        <NavigationSheet address={locationStr} onClose={() => setNavOpen(false)} />
      )}
      {msgOpen && phone && (
        <MessageSheet
          phone={phone}
          clientName={e.client?.full_name || ""}
          context={e.title || e.number || undefined}
          onClose={() => setMsgOpen(false)}
        />
      )}
    </>
  );
}

// ─── Today Job Card ───────────────────────────────────────────────────────────

function TodayJobCard({ job }: { job: TodayJob }) {
  const [navOpen, setNavOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const statusCfg = JOB_STATUS_CONFIG[job.status];
  const ttc = job.estimate
    ? (job.estimate.total_amount_ht || 0) * (1 + (job.estimate.vat_rate || 20) / 100)
    : null;

  const clientAddress = [job.client?.address, job.client?.city].filter(Boolean).join(", ");
  const address = job.address || clientAddress || null;
  const phone = job.client?.phone?.replace(/[\s\-\.]/g, "").replace(/^0/, "+32") || null;

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <Link href={`/chantiers/${job.id}`} className="block px-4 pt-4 pb-3 active:bg-slate-50">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-base font-black text-slate-900 leading-tight flex-1">{job.title}</p>
            <span className={cn(
              "text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5",
              statusCfg.color
            )}>
              {statusCfg.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {job.scheduled_date && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3 text-slate-400" />
                {formatTime(job.scheduled_date)}
              </span>
            )}
            {job.estimated_hours && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3 text-blue-400" />
                {formatDuration(job.estimated_hours)}
              </span>
            )}
            {ttc !== null && (
              <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                <Euro className="w-3 h-3" />
                {formatCurrency(ttc)}
              </span>
            )}
          </div>
        </Link>

        {/* Separator */}
        <div className="border-t border-slate-100" />

        {/* Actions row */}
        <div className="flex divide-x divide-slate-100">
          {/* Call client */}
          {job.client && phone && (
            <a
              href={`tel:${phone}`}
              className="flex-1 flex items-center gap-2 px-3 py-3 active:bg-slate-50"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{job.client.full_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{job.client.phone}</p>
              </div>
            </a>
          )}
          {/* No phone — just show client name as link */}
          {job.client && !phone && (
            <Link
              href={`/clients/${job.client.id}`}
              className="flex-1 flex items-center gap-2 px-3 py-3 active:bg-slate-50"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Users className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate">{job.client.full_name}</p>
            </Link>
          )}

          {/* Message */}
          {phone && (
            <button
              onClick={() => setMsgOpen(true)}
              className="flex items-center gap-2 px-3 py-3 active:bg-slate-50"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-slate-700 hidden sm:block">Message</p>
            </button>
          )}

          {/* Itinéraire */}
          {address && (
            <button
              onClick={() => setNavOpen(true)}
              className="flex items-center gap-2 px-3 py-3 active:bg-slate-50"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                <Navigation className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="text-xs font-semibold text-slate-900 truncate max-w-[120px]">{address}</p>
                <p className="text-[10px] text-slate-400">Itinéraire</p>
              </div>
              <p className="text-xs font-semibold text-sky-600 sm:hidden">Y aller</p>
            </button>
          )}

          {/* Voir le chantier */}
          <Link
            href={`/chantiers/${job.id}`}
            className="flex items-center justify-center px-3 py-3 active:bg-slate-50"
          >
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        </div>
      </div>

      {navOpen && address && (
        <NavigationSheet address={address} onClose={() => setNavOpen(false)} />
      )}
      {msgOpen && phone && (
        <MessageSheet
          phone={phone}
          clientName={job.client?.full_name || ""}
          context={job.title}
          onClose={() => setMsgOpen(false)}
        />
      )}
    </>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon, label, href, linkLabel = "Voir tout",
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      </div>
      {href && (
        <Link href={href} className="text-xs text-slate-400 font-medium hover:text-blue-600">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
