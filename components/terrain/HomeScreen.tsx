"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap, FileText, Users, MapPin, Phone, Clock,
  ChevronRight, AlertTriangle, Calendar, CheckCircle2,
  Eye, TrendingUp, ScanLine, Settings, BarChart2,
  Download, Link2, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppMode } from "@/hooks/useAppMode";
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

// ─── Shared helpers ───────────────────────────────────────────────────────────

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
  return h < 12 ? "Bonne journée" : h < 18 ? "Bon après-midi" : "Bonsoir";
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
          {action.label}
        </Link>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, label, color, href }: {
  icon: React.ElementType; label: string; color: string; href: string;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 active:bg-slate-50">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{label}</span>
    </Link>
  );
}

function NavLinkRow({ icon: Icon, iconBg, iconColor, label, sublabel, href, badge }: {
  icon: React.ElementType; iconBg: string; iconColor: string;
  label: string; sublabel?: string; href: string; badge?: number;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3 active:bg-slate-50">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", iconBg)}>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
      {badge != null && badge > 0 && (
        <span className="text-[10px] font-black text-white bg-red-500 rounded-full px-1.5 py-0.5 min-w-[18px] text-center mr-1">
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
  const pathname = usePathname();
  const { mode } = useAppMode(pathname);

  const pendingCount  = pendingEstimates.length;
  const pendingTTC    = pendingEstimates.reduce((s, e) => s + ttc(e.total_amount_ht, e.vat_rate), 0);

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* ── Greeting header — identique dans les deux modes ─────────────── */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs font-semibold text-slate-400 capitalize">{todayLabel()}</p>
        <h1 className="text-xl font-black text-slate-900 mt-0.5">
          {greeting()}{business?.name ? ` · ${business.name}` : ""}
        </h1>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-8">
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
              recentInvoices={recentInvoices}
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
  const todayJobs = nextJobs.filter((j) => isToday(j.scheduled_date));

  return (
    <>
      {/* ── Prochaine intervention ─────────────────────────────────────── */}
      <div>
        <SectionLabel
          icon={<Calendar className="w-3.5 h-3.5" />}
          label={todayJobs.length > 0
            ? `Aujourd'hui — ${todayJobs.length} intervention${todayJobs.length > 1 ? "s" : ""}`
            : "Prochaine intervention"}
          action={nextJobs.length > 1 ? { label: "Planning", href: "/planning" } : undefined}
        />
        {nextJobs.length > 0 ? (
          <div className="flex flex-col gap-2">
            {nextJobs.slice(0, 2).map((job) => (
              <Link key={job.id} href={`/chantiers/${job.id}`}>
                <div className={cn(
                  "bg-white rounded-2xl border-2 p-4 flex flex-col gap-2.5 active:opacity-80",
                  isToday(job.scheduled_date)
                    ? "border-blue-300 shadow-md shadow-blue-100"
                    : "border-slate-100 shadow-sm"
                )}>
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
                  <div>
                    <p className="font-bold text-slate-900 text-sm leading-snug">{job.title}</p>
                    {job.client && <p className="text-xs text-slate-500 mt-0.5">{job.client.full_name}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.address && (
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5 active:bg-blue-100">
                        <MapPin className="w-3 h-3" />Y aller
                      </a>
                    )}
                    {job.client?.phone && (
                      <a href={`tel:${job.client.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5 active:bg-emerald-100">
                        <Phone className="w-3 h-3" />Appeler
                      </a>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-slate-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-700">Aucune intervention planifiée</p>
              <p className="text-xs text-slate-400 mt-0.5">Créez une intervention via le +</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats chips ─────────────────────────────────────────────────── */}
      {(pendingCount > 0 || urgentRelances > 0) && (
        <div className="flex gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Link href="/devis" className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm active:bg-slate-50">
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-bold text-slate-700">{pendingCount} devis</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs font-semibold text-slate-500">{fmt(pendingTTC)}</span>
              <ChevronRight className="w-3 h-3 text-slate-300 ml-0.5" />
            </Link>
          )}
          {urgentRelances > 0 && (
            <Link href="/relances" className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 active:bg-red-100">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-bold text-red-700">{urgentRelances} urgente{urgentRelances > 1 ? "s" : ""}</span>
              <ChevronRight className="w-3 h-3 text-red-300 ml-0.5" />
            </Link>
          )}
        </div>
      )}

      {/* ── Actions rapides terrain ──────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<Zap className="w-3.5 h-3.5" />} label="Actions rapides" />
        <div className="grid grid-cols-3 gap-2">
          <QuickAction icon={Zap}      label="Intervention" color="bg-amber-500"   href="/interventions/nouveau" />
          <QuickAction icon={FileText} label="Devis rapide" color="bg-blue-600"    href="/devis/nouveau" />
          <QuickAction icon={Users}    label="Nouveau client" color="bg-emerald-600" href="/clients/nouveau" />
        </div>
      </div>

      {/* ── Devis en attente ─────────────────────────────────────────────── */}
      {pendingEstimates.length > 0 && (
        <div>
          <SectionLabel
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Devis en attente"
            action={{ label: "Voir tout", href: "/devis" }}
          />
          <div className="flex flex-col gap-2">
            {pendingEstimates.slice(0, 4).map((est) => {
              const urgent = isUrgent(est);
              return (
                <Link key={est.id} href={`/devis/${est.id}`}>
                  <div className={cn(
                    "bg-white rounded-xl border px-4 py-3 flex items-center gap-3 active:opacity-80",
                    urgent ? "border-orange-200" : "border-slate-100"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
                      est.status === "viewed" ? (urgent ? "bg-orange-500" : "bg-blue-400") : "bg-slate-300"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{est.client?.full_name ?? "Sans client"}</p>
                      <p className="text-xs text-slate-400 truncate">{est.title ?? est.number ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {est.status === "viewed" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          <Eye className="w-2.5 h-2.5" />Vu
                        </span>
                      )}
                      {urgent && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Relancer</span>
                      )}
                      <span className="text-sm font-bold text-slate-700">{fmt(ttc(est.total_amount_ht, est.vat_rate))}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Liens secondaires terrain ────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <NavLinkRow icon={Calendar}     iconBg="bg-violet-50"  iconColor="text-violet-600"  label="Planning complet"  href="/planning" />
        <NavLinkRow icon={CheckCircle2} iconBg="bg-orange-50"  iconColor="text-orange-500"  label="Relances & suivi"  href="/relances" badge={urgentRelances} />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function AdminBlocks({ business, recentInvoices, monthRevenueTTC, pendingCount, pendingTTC, urgentRelances }: {
  business: Business | null;
  recentInvoices: RecentInvoice[];
  monthRevenueTTC: number;
  pendingCount: number;
  pendingTTC: number;
  urgentRelances: number;
}) {
  const providerLabel = business?.accounting_provider
    ? business.accounting_provider.charAt(0).toUpperCase() + business.accounting_provider.slice(1)
    : null;
  const billingLabel = business?.billing_mode === "peppol" ? "Peppol"
    : business?.billing_mode === "both" ? "PDF + Peppol"
    : "PDF / Email";

  return (
    <>
      {/* ── Résumé financier ─────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<TrendingUp className="w-3.5 h-3.5" />} label="Ce mois" action={{ label: "Finances", href: "/revenus" }} />
        <div className="flex gap-2">
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 mb-1">CA encaissé</p>
            <p className="text-xl font-black text-slate-900">{fmt(monthRevenueTTC)}</p>
          </div>
          {pendingCount > 0 && (
            <Link href="/devis" className="flex-1 bg-white rounded-2xl border border-blue-100 shadow-sm p-4 active:bg-blue-50">
              <p className="text-xs font-semibold text-slate-400 mb-1">En attente</p>
              <p className="text-xl font-black text-blue-600">{fmt(pendingTTC)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{pendingCount} devis</p>
            </Link>
          )}
        </div>
      </div>

      {/* ── Actions rapides admin ────────────────────────────────────────��─ */}
      <div>
        <SectionLabel icon={<Zap className="w-3.5 h-3.5" />} label="Actions rapides" />
        <div className="grid grid-cols-3 gap-2">
          <QuickAction icon={FileText}   label="Nouveau devis"  color="bg-blue-600"    href="/devis/nouveau" />
          <QuickAction icon={Users}      label="Clients"        color="bg-emerald-600" href="/clients" />
          <QuickAction icon={TrendingUp} label="Finances"       color="bg-violet-600"  href="/revenus" />
        </div>
      </div>

      {/* ── Factures récentes ────────────────────────────────────────────── */}
      {recentInvoices.length > 0 && (
        <div>
          <SectionLabel
            icon={<CreditCard className="w-3.5 h-3.5" />}
            label="Factures récentes"
            action={{ label: "Voir tout", href: "/devis" }}
          />
          <div className="flex flex-col gap-2">
            {recentInvoices.slice(0, 4).map((inv) => (
              <Link key={inv.id} href={`/devis/${inv.id}`}>
                <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3 active:opacity-80">
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    inv.status === "paid" ? "bg-emerald-500"
                    : inv.status === "invoiced" ? "bg-blue-400"
                    : "bg-amber-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{inv.client?.full_name ?? "Sans client"}</p>
                    <p className="text-xs text-slate-400 truncate">{inv.title ?? inv.number ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      inv.status === "paid"     ? "bg-emerald-100 text-emerald-700"
                      : inv.status === "invoiced" ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                    )}>
                      {inv.status === "paid" ? "Payé" : inv.status === "invoiced" ? "Facturé" : "Accepté"}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{fmt(ttc(inv.total_amount_ht, inv.vat_rate))}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Documents & Scans ────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<ScanLine className="w-3.5 h-3.5" />} label="Documents" />
        <NavLinkRow
          icon={ScanLine} iconBg="bg-slate-100" iconColor="text-slate-600"
          label="Mes scans & documents" sublabel="Tickets, factures fournisseurs, documents"
          href="/documents"
        />
      </div>

      {/* ── Comptabilité ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<BarChart2 className="w-3.5 h-3.5" />} label="Comptabilité" action={{ label: "Configurer", href: "/profil/comptabilite" }} />
        <div className="flex flex-col gap-1.5">
          <Link href="/profil/comptabilite" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 active:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800">
                  {providerLabel ?? "Aucun outil configuré"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Facturation : {billingLabel}
                  {business?.accounting_email ? ` · CC : ${business.accounting_email}` : ""}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            </div>
            {/* Status chips */}
            <div className="flex gap-1.5 flex-wrap">
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                business?.accounting_provider ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
              )}>
                {business?.accounting_provider ? "Préparé" : "Non configuré"}
              </span>
              {(business?.billing_mode === "peppol" || business?.billing_mode === "both") && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Peppol préparé
                </span>
              )}
            </div>
          </Link>

          <NavLinkRow icon={Download}  iconBg="bg-blue-50"   iconColor="text-blue-600"   label="Export comptable"      sublabel="Télécharger les factures du mois"  href="/profil" />
          <NavLinkRow icon={Link2}     iconBg="bg-violet-50" iconColor="text-violet-600" label="Connexions comptables"  sublabel="Odoo, Exact, Yuki, Billit…"        href="/profil/comptabilite" />
        </div>
      </div>

      {/* ── Pilotage & paramètres ────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<Settings className="w-3.5 h-3.5" />} label="Pilotage" />
        <div className="flex flex-col gap-1.5">
          <NavLinkRow icon={BarChart2}     iconBg="bg-blue-50"   iconColor="text-blue-600"   label="Dashboard & statistiques"  sublabel="CA, devis, taux d'acceptation"  href="/dashboard" />
          <NavLinkRow icon={CheckCircle2}  iconBg="bg-orange-50" iconColor="text-orange-500" label="Relances"                   sublabel="Suivi et envoi des relances"     href="/relances" badge={urgentRelances} />
          <NavLinkRow icon={Settings}      iconBg="bg-slate-100" iconColor="text-slate-600"  label="Paramètres entreprise"      sublabel="Profil, logo, IBAN, TVA"        href="/profil/entreprise" />
        </div>
      </div>
    </>
  );
}
