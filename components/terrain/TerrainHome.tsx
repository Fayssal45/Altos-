"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap, FileText, Users, MapPin, Phone, Clock,
  ChevronRight, AlertTriangle, Calendar, CheckCircle2,
  ArrowRight, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NextJob {
  id: string;
  title: string;
  status: "planned" | "in_progress";
  scheduled_date: string | null;
  address: string | null;
  client: { id: string; full_name: string; phone: string | null; address: string | null; city: string | null } | null;
}

interface PendingEstimate {
  id: string;
  number: string | null;
  title: string | null;
  status: "sent" | "viewed";
  total_amount_ht: number;
  vat_rate: number;
  viewed_at: string | null;
  created_at: string;
  client: { id: string; full_name: string; phone: string | null } | null;
}

interface TerrainHomeProps {
  businessName: string;
  nextJobs: NextJob[];
  pendingEstimates: PendingEstimate[];
  urgentRelances: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJobDate(iso: string | null): string {
  if (!iso) return "Non planifié";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const jobDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (jobDay.getTime() === today.getTime()) {
    return `Aujourd'hui · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (jobDay.getTime() === tomorrow.getTime()) {
    return `Demain · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function isUrgentEstimate(est: PendingEstimate): boolean {
  if (est.status !== "viewed" || !est.viewed_at) return false;
  return Date.now() - new Date(est.viewed_at).getTime() > 48 * 3600 * 1000;
}

function formatAmount(ht: number, vat: number): string {
  const ttc = ht * (1 + vat / 100);
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(ttc);
}

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonne journée";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// ─── Component ──��─────────────────────────────────────────────────────────────

export default function TerrainHome({
  businessName, nextJobs, pendingEstimates, urgentRelances,
}: TerrainHomeProps) {
  const router = useRouter();
  const todayJobs = nextJobs.filter((j) => isToday(j.scheduled_date));
  const upcomingJobs = nextJobs.filter((j) => !isToday(j.scheduled_date));
  const nextJob = nextJobs[0] ?? null;
  const pendingCount = pendingEstimates.length;
  const totalPending = pendingEstimates.reduce((s, e) => s + e.total_amount_ht * (1 + e.vat_rate / 100), 0);

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs font-semibold text-slate-400 capitalize">{todayLabel()}</p>
        <h1 className="text-xl font-black text-slate-900 mt-0.5">
          {greetingText()}{businessName ? ` · ${businessName}` : ""}
        </h1>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-8">

        {/* ── Prochaine intervention ───────────────────────────────────── */}
        {nextJob ? (
          <div>
            <SectionLabel
              icon={<Calendar className="w-3.5 h-3.5" />}
              label={todayJobs.length > 0 ? `Aujourd'hui — ${todayJobs.length} intervention${todayJobs.length > 1 ? "s" : ""}` : "Prochaine intervention"}
            />
            <div className="flex flex-col gap-2">
              {nextJobs.slice(0, 2).map((job) => (
                <Link key={job.id} href={`/chantiers/${job.id}`}>
                  <div className={cn(
                    "bg-white rounded-2xl border-2 p-4 flex flex-col gap-2.5 active:opacity-80",
                    isToday(job.scheduled_date)
                      ? "border-blue-400 shadow-md shadow-blue-100"
                      : "border-slate-100 shadow-sm"
                  )}>
                    {/* Status + time */}
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full",
                        job.status === "in_progress"
                          ? "bg-amber-100 text-amber-700"
                          : isToday(job.scheduled_date)
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      )}>
                        {job.status === "in_progress" ? "En cours" : formatJobDate(job.scheduled_date)}
                      </span>
                      <span className="flex-1" />
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>

                    {/* Title + client */}
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-snug">{job.title}</p>
                      {job.client && (
                        <p className="text-xs text-slate-500 mt-0.5">{job.client.full_name}</p>
                      )}
                    </div>

                    {/* Address + CTA row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5 active:bg-blue-100"
                        >
                          <MapPin className="w-3 h-3" />
                          Y aller
                        </a>
                      )}
                      {job.client?.phone && (
                        <a
                          href={`tel:${job.client.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5 active:bg-emerald-100"
                        >
                          <Phone className="w-3 h-3" />
                          Appeler
                        </a>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              {upcomingJobs.length > 0 && todayJobs.length === 0 && (
                <Link
                  href="/planning"
                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-400"
                >
                  Voir le planning complet
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-700">Aucune intervention planifiée</p>
              <p className="text-xs text-slate-400 mt-0.5">Ajoutez via le planning ou créez une intervention rapide</p>
            </div>
          </div>
        )}

        {/* ── Stats chips ──────────────────────────────────────────────── */}
        {(pendingCount > 0 || urgentRelances > 0) && (
          <div className="flex gap-2 flex-wrap">
            {pendingCount > 0 && (
              <Link
                href="/devis"
                className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm active:bg-slate-50"
              >
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-bold text-slate-700">
                  {pendingCount} devis
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-semibold text-slate-500">
                  {new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(totalPending)}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-300 ml-0.5" />
              </Link>
            )}
            {urgentRelances > 0 && (
              <Link
                href="/relances"
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 active:bg-red-100"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-bold text-red-700">
                  {urgentRelances} urgente{urgentRelances > 1 ? "s" : ""}
                </span>
                <ChevronRight className="w-3 h-3 text-red-300 ml-0.5" />
              </Link>
            )}
          </div>
        )}

        {/* ── Actions rapides ──────────────────────────────────────────── */}
        <div>
          <SectionLabel icon={<Zap className="w-3.5 h-3.5" />} label="Actions rapides" />
          <div className="grid grid-cols-3 gap-2">
            <QuickAction
              icon={Zap}
              label="Intervention"
              color="bg-amber-500"
              href="/interventions/nouveau"
            />
            <QuickAction
              icon={FileText}
              label="Devis rapide"
              color="bg-blue-600"
              href="/devis/nouveau"
            />
            <QuickAction
              icon={Users}
              label="Nouveau client"
              color="bg-emerald-600"
              href="/clients/nouveau"
            />
          </div>
        </div>

        {/* ── Devis en attente ─────────────────────────────────────────── */}
        {pendingEstimates.length > 0 && (
          <div>
            <SectionLabel
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Devis en attente"
              action={{ label: "Voir tout", href: "/devis" }}
            />
            <div className="flex flex-col gap-2">
              {pendingEstimates.slice(0, 4).map((est) => {
                const urgent = isUrgentEstimate(est);
                return (
                  <Link key={est.id} href={`/devis/${est.id}`}>
                    <div className={cn(
                      "bg-white rounded-xl border px-4 py-3 flex items-center gap-3 active:opacity-80",
                      urgent ? "border-orange-200" : "border-slate-100"
                    )}>
                      {/* Status dot */}
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        est.status === "viewed" ? (urgent ? "bg-orange-500" : "bg-blue-400") : "bg-slate-300"
                      )} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {est.client?.full_name ?? "Sans client"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {est.title ?? est.number ?? "—"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {est.status === "viewed" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            <Eye className="w-2.5 h-2.5" />
                            Vu
                          </span>
                        )}
                        {urgent && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            Relancer
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-700">
                          {formatAmount(est.total_amount_ht, est.vat_rate)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Liens secondaires ────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <Link
            href="/planning"
            className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3 active:bg-slate-50"
          >
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-violet-600" />
            </div>
            <span className="text-sm font-semibold text-slate-700 flex-1">Planning complet</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
          <Link
            href="/relances"
            className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3 active:bg-slate-50"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm font-semibold text-slate-700 flex-1">Relances & suivi</span>
            {urgentRelances > 0 && (
              <span className="text-[10px] font-black text-white bg-red-500 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {urgentRelances}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({
  icon, label, action,
}: {
  icon: React.ReactNode;
  label: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex-1">{label}</span>
      {action && (
        <Link href={action.href} className="text-[11px] font-semibold text-blue-500">
          {action.label}
        </Link>
      )}
    </div>
  );
}

function QuickAction({
  icon: Icon, label, color, href,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 active:bg-slate-50"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{label}</span>
    </Link>
  );
}
