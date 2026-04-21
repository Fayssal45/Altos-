"use client";

import Link from "next/link";
import {
  Zap, FileText, Users, MapPin, Phone, Clock,
  ChevronRight, AlertTriangle, Calendar, CheckCircle2,
  Eye, TrendingUp, ScanLine, Settings, BarChart2,
  Link2, BookOpen, Plus,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppMode } from "@/contexts/AppModeContext";
import type { Business } from "@/lib/types";

// ─── Shared types ─────────────────────────────────────────────────────────────

interface NextJob {
  id: string;
  title: string;
  status: "planned" | "in_progress";
  scheduled_date: string | null;
  address: string | null;
  client: { id: string; full_name: string; phone: string | null; city: string | null } | null;
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
interface RecentInvoice {
  id: string;
  number: string | null;
  title: string | null;
  status: "accepted" | "invoiced" | "paid";
  total_amount_ht: number;
  vat_rate: number;
  paid_at: string | null;
  signed_at: string | null;
  issued_at: string;
  client: { id: string; full_name: string } | null;
}
interface HomeScreenProps {
  business: Business | null;
  nextJobs: NextJob[];
  pendingEstimates: PendingEstimate[];
  urgentRelances: number;
  recentInvoices: RecentInvoice[];
  monthRevenueTTC: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function ttc(ht: number, vat: number) { return ht * (1 + vat / 100); }

function formatJobDate(iso: string | null): string {
  if (!iso) return "Non planifié";
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (day.getTime() === today.getTime())    return `Aujourd'hui · ${time}`;
  if (day.getTime() === tomorrow.getTime()) return `Demain · ${time}`;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function isUrgent(est: PendingEstimate) {
  return est.status === "viewed" && !!est.viewed_at
    && Date.now() - new Date(est.viewed_at).getTime() > 48 * 3600 * 1000;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

function todayLabel() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionLabel({ icon, label, action }: {
  icon: React.ReactNode;
  label: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex-1">{label}</span>
      {action && (
        <Link href={action.href} className="text-[11px] font-semibold text-blue-500 active:text-blue-700">
          {action.label} →
        </Link>
      )}
    </div>
  );
}

function NavLinkRow({ icon: Icon, iconBg, iconColor, label, sublabel, href, badge, badgeColor = "bg-red-500" }: {
  icon: React.ElementType; iconBg: string; iconColor: string;
  label: string; sublabel?: string; href: string;
  badge?: number; badgeColor?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3 active:bg-slate-50 shadow-sm">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
        <Icon className={cn("w-4.5 h-4.5", iconColor)} style={{ width: 18, height: 18 }} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {sublabel && <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{sublabel}</p>}
      </div>
      {badge != null && badge > 0 && (
        <span className={cn("text-[10px] font-black text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center mr-0.5", badgeColor)}>
          {badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomeScreen({
  business, nextJobs, pendingEstimates, urgentRelances, recentInvoices, monthRevenueTTC,
}: HomeScreenProps) {
  const { mode } = useAppMode();

  const pendingCount = pendingEstimates.length;
  const pendingTTC   = pendingEstimates.reduce((s, e) => s + ttc(e.total_amount_ht, e.vat_rate), 0);

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[11px] font-semibold text-slate-400 capitalize">{todayLabel()}</p>
        <h1 className="text-lg font-black text-slate-900 mt-0.5 leading-tight">
          {greeting()}{business?.name ? `, ${business.name}` : ""}
        </h1>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-10">
        {mode === "terrain"
          ? <TerrainBlocks
              nextJobs={nextJobs}
              pendingEstimates={pendingEstimates}
              urgentRelances={urgentRelances}
              pendingCount={pendingCount}
              pendingTTC={pendingTTC}
            />
          : <AdminBlocks
              business={business}
              monthRevenueTTC={monthRevenueTTC}
              pendingCount={pendingCount}
              pendingTTC={pendingTTC}
              urgentRelances={urgentRelances}
            />
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TERRAIN BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function TerrainBlocks({ nextJobs, pendingEstimates, urgentRelances, pendingCount, pendingTTC }: {
  nextJobs: NextJob[];
  pendingEstimates: PendingEstimate[];
  urgentRelances: number;
  pendingCount: number;
  pendingTTC: number;
}) {
  const todayJobs  = nextJobs.filter((j) => isToday(j.scheduled_date));
  const firstJob   = nextJobs[0] ?? null;

  return (
    <>
      {/* ── CTA principal — Intervention rapide ───────────────────────────── */}
      <Link href="/interventions/nouveau">
        <div className="rounded-2xl overflow-hidden shadow-lg shadow-amber-200/60 active:opacity-90"
          style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}>
          <div className="px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-black text-base leading-tight">Intervention rapide</p>
              <p className="text-orange-100 text-[12px] font-medium mt-0.5">Créer + facturer en 30 secondes</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </Link>

      {/* ── Actions rapides (2 colonnes) ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/devis/nouveau"
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 active:bg-slate-50">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Devis rapide</p>
            <p className="text-[11px] text-slate-400">Nouveau devis</p>
          </div>
        </Link>
        <Link href="/clients/nouveau"
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 active:bg-slate-50">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Nouveau client</p>
            <p className="text-[11px] text-slate-400">Ajouter un client</p>
          </div>
        </Link>
      </div>

      {/* ── Relances urgentes (si existantes) ──────────────────────────────── */}
      {urgentRelances > 0 && (
        <Link href="/relances">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3 active:bg-red-100">
            <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800">
                {urgentRelances} relance{urgentRelances > 1 ? "s" : ""} urgente{urgentRelances > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-red-500 mt-0.5">Devis vus, sans réponse depuis 48h+</p>
            </div>
            <ChevronRight className="w-4 h-4 text-red-300 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* ── Planning du jour / prochaine intervention ──────────────────────── */}
      <div>
        <SectionLabel
          icon={<Calendar className="w-3.5 h-3.5" />}
          label={todayJobs.length > 0
            ? `Aujourd'hui — ${todayJobs.length} intervention${todayJobs.length > 1 ? "s" : ""}`
            : "Prochaine intervention"}
          action={nextJobs.length > 1 ? { label: "Planning", href: "/planning" } : undefined}
        />
        {firstJob ? (
          <Link href={`/chantiers/${firstJob.id}`}>
            <div className={cn(
              "bg-white rounded-2xl border-2 p-4 flex flex-col gap-2.5 active:opacity-80 shadow-sm",
              isToday(firstJob.scheduled_date)
                ? "border-blue-200 shadow-blue-100/60"
                : "border-slate-100"
            )}>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-black px-2.5 py-1 rounded-full",
                  firstJob.status === "in_progress"
                    ? "bg-amber-100 text-amber-700"
                    : isToday(firstJob.scheduled_date)
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-500"
                )}>
                  {firstJob.status === "in_progress" ? "En cours" : formatJobDate(firstJob.scheduled_date)}
                </span>
                <span className="flex-1" />
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm leading-snug">{firstJob.title}</p>
                {firstJob.client && <p className="text-xs text-slate-500 mt-0.5">{firstJob.client.full_name}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {firstJob.address && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(firstJob.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5 active:bg-blue-100">
                    <MapPin className="w-3 h-3" />Y aller
                  </a>
                )}
                {firstJob.client?.phone && (
                  <a href={`tel:${firstJob.client.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5 active:bg-emerald-100">
                    <Phone className="w-3 h-3" />Appeler
                  </a>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/interventions/nouveau">
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-4 flex items-center gap-3 active:bg-slate-50">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-600">Aucune intervention planifiée</p>
                <p className="text-xs text-slate-400 mt-0.5">Créer une intervention →</p>
              </div>
            </div>
          </Link>
        )}

        {/* Interventions suivantes */}
        {nextJobs.length > 1 && (
          <div className="flex flex-col gap-1.5 mt-1.5">
            {nextJobs.slice(1, 3).map((job) => (
              <Link key={job.id} href={`/chantiers/${job.id}`}>
                <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3 active:opacity-80">
                  <span className="text-[10px] font-bold text-slate-400 w-[70px] flex-shrink-0">
                    {formatJobDate(job.scheduled_date)}
                  </span>
                  <p className="text-sm font-semibold text-slate-700 flex-1 truncate">{job.title}</p>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Devis en attente ──────────────────────────────────────────────── */}
      <div>
        <SectionLabel
          icon={<Clock className="w-3.5 h-3.5" />}
          label={pendingCount > 0
            ? `Devis en attente · ${fmt(pendingTTC)}`
            : "Devis en attente"}
          action={{ label: "Voir tout", href: "/devis" }}
        />
        {pendingEstimates.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {pendingEstimates.slice(0, 4).map((est) => {
              const urgent = isUrgent(est);
              return (
                <Link key={est.id} href={`/devis/${est.id}/edit`}>
                  <div className={cn(
                    "bg-white rounded-xl border px-4 py-3 flex items-center gap-3 active:opacity-80",
                    urgent ? "border-orange-200 bg-orange-50/40" : "border-slate-100"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-0.5",
                      urgent ? "bg-orange-500" : est.status === "viewed" ? "bg-blue-400" : "bg-slate-300"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{est.client?.full_name ?? "Sans client"}</p>
                      <p className="text-[11px] text-slate-400 truncate">{est.title ?? est.number ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {urgent && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Relancer</span>
                      )}
                      {!urgent && est.status === "viewed" && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          <Eye className="w-2.5 h-2.5" />Vu
                        </span>
                      )}
                      <span className="text-sm font-bold text-slate-700">{fmt(ttc(est.total_amount_ht, est.vat_rate))}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
            <FileText className="w-4 h-4 text-slate-300" />
            <p className="text-sm text-slate-400">Aucun devis en attente</p>
          </div>
        )}
      </div>

      {/* ── Liens utiles terrain ──────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<ChevronRight className="w-3.5 h-3.5" />} label="Accès rapide" />
        <div className="flex flex-col gap-1.5">
          <NavLinkRow icon={Calendar}     iconBg="bg-violet-50"  iconColor="text-violet-600"
            label="Planning complet"     sublabel="Toutes vos interventions" href="/planning" />
          <NavLinkRow icon={CheckCircle2} iconBg="bg-orange-50"  iconColor="text-orange-500"
            label="Relances & suivi"     sublabel="Suivi des devis envoyés" href="/relances"
            badge={urgentRelances} badgeColor="bg-red-500" />
          <NavLinkRow icon={BookOpen}     iconBg="bg-teal-50"    iconColor="text-teal-600"
            label="Catalogue"            sublabel="Vos services et tarifs" href="/catalogue" />
          <NavLinkRow icon={Users}        iconBg="bg-emerald-50" iconColor="text-emerald-600"
            label="Tous les clients"     sublabel="Carnet d'adresses" href="/clients" />
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

// Cockpit tile — compact square button
function CockpitTile({ icon: Icon, label, href, bg, color, badge }: {
  icon: React.ElementType; label: string; href: string;
  bg: string; color: string; badge?: number;
}) {
  return (
    <Link href={href} className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center gap-2 active:bg-slate-50 btn-tactile">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", bg)}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <span className="text-[12px] font-bold text-slate-700 text-center leading-tight">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute top-2.5 right-2.5 min-w-[18px] h-4.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

function AdminBlocks({ business, monthRevenueTTC, pendingCount, pendingTTC, urgentRelances }: {
  business: Business | null;
  monthRevenueTTC: number;
  pendingCount: number;
  pendingTTC: number;
  urgentRelances: number;
}) {
  return (
    <>
      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-[11px] font-semibold text-slate-400 mb-1">CA encaissé ce mois</p>
          <p className="text-xl font-black text-slate-900">{fmt(monthRevenueTTC)}</p>
          <p className="text-[10px] text-slate-400 mt-1">TTC · mois en cours</p>
        </div>
        <Link href="/devis" className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 active:bg-blue-50">
          <p className="text-[11px] font-semibold text-slate-400 mb-1">Devis en attente</p>
          <p className="text-xl font-black text-blue-600">{fmt(pendingTTC)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{pendingCount} devis · TTC</p>
        </Link>
      </div>

      {/* ── Cockpit — grille 3×2 ─────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<Zap className="w-3.5 h-3.5" />} label="Actions" />
        <div className="grid grid-cols-3 gap-2">
          <CockpitTile icon={FileText}   label="Devis"        href="/devis"                 bg="bg-blue-100"   color="text-blue-600"   badge={pendingCount} />
          <CockpitTile icon={Receipt}    label="Factures"     href="/devis"                 bg="bg-violet-100" color="text-violet-600" />
          <CockpitTile icon={Users}      label="Clients"      href="/clients"               bg="bg-emerald-100" color="text-emerald-600" />
          <CockpitTile icon={TrendingUp} label="Finances"     href="/revenus"               bg="bg-teal-100"   color="text-teal-600"   />
          <CockpitTile icon={ScanLine}   label="Documents"    href="/documents"             bg="bg-slate-100"  color="text-slate-600"  />
          <CockpitTile icon={Link2}      label="Comptabilité" href="/profil/comptabilite"   bg="bg-amber-100"  color="text-amber-600"  />
        </div>
      </div>

      {/* ── Pilotage ─────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<BarChart2 className="w-3.5 h-3.5" />} label="Pilotage" />
        <div className="flex flex-col gap-1.5">
          <NavLinkRow icon={BarChart2}    iconBg="bg-blue-50"   iconColor="text-blue-600"
            label="Dashboard"  sublabel="CA, devis, taux d'acceptation" href="/dashboard" />
          <NavLinkRow icon={CheckCircle2} iconBg="bg-orange-50" iconColor="text-orange-500"
            label="Relances"   sublabel="Devis sans réponse" href="/relances"
            badge={urgentRelances} badgeColor="bg-red-500" />
        </div>
      </div>

      {/* ── Paramètres ───────────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<Settings className="w-3.5 h-3.5" />} label="Paramètres" />
        <div className="flex flex-col gap-1.5">
          <NavLinkRow icon={Link2}    iconBg="bg-violet-50" iconColor="text-violet-600"
            label="Connexions comptables" sublabel="Odoo, Exact, Yuki, Billit…" href="/profil/comptabilite" />
          <NavLinkRow icon={Settings} iconBg="bg-slate-100"  iconColor="text-slate-600"
            label="Paramètres entreprise" sublabel="Profil, logo, IBAN, TVA"    href="/profil/entreprise" />
        </div>
      </div>
    </>
  );
}
