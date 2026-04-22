"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Clock, CheckCircle2,
  AlertCircle, ChevronDown, ChevronRight,
  FileText, User, BarChart2, Receipt,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type EstimateRow = {
  id: string;
  number: string | null;
  title: string | null;
  status: string;
  total_amount_ht: number;
  vat_rate: number;
  issued_at: string;
  paid_at: string | null;
  client: { id: string; full_name: string; company_name: string | null } | null;
};

type Period = "today" | "7d" | "30d" | "month" | "lastMonth" | "year" | "custom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ttc  = (e: EstimateRow) => (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100);
const ht   = (e: EstimateRow) => e.total_amount_ht || 0;
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOf   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function getRange(p: Period, cf: string, ct: string) {
  const now = new Date();
  const today = startOf(now);
  switch (p) {
    case "today":     return { from: today, to: endOf(today) };
    case "7d":        return { from: new Date(today.getTime() - 6 * 864e5), to: endOf(today) };
    case "30d":       return { from: new Date(today.getTime() - 29 * 864e5), to: endOf(today) };
    case "month":     return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOf(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "lastMonth": return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: endOf(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "year":      return { from: new Date(now.getFullYear(), 0, 1), to: endOf(new Date(now.getFullYear(), 11, 31)) };
    case "custom":    return {
      from: cf ? startOf(new Date(cf)) : new Date(now.getFullYear(), 0, 1),
      to:   ct ? endOf(new Date(ct))   : endOf(today),
    };
  }
}

function getPrevRange(p: Period, range: { from: Date; to: Date }) {
  const now = new Date();
  const span = range.to.getTime() - range.from.getTime();
  switch (p) {
    case "month":     return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: endOf(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "lastMonth": return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: endOf(new Date(now.getFullYear(), now.getMonth() - 1, 0)) };
    case "year":      return { from: new Date(now.getFullYear() - 1, 0, 1), to: endOf(new Date(now.getFullYear() - 1, 11, 31)) };
    default:          return { from: new Date(range.from.getTime() - span - 1), to: new Date(range.from.getTime() - 1) };
  }
}

type Gran = "day" | "week" | "month";
function granularity(from: Date, to: Date): Gran {
  const d = (to.getTime() - from.getTime()) / 864e5;
  return d <= 35 ? "day" : d <= 120 ? "week" : "month";
}

function buildChart(paid: EstimateRow[], from: Date, to: Date, gran: Gran) {
  const buckets: { label: string; value: number }[] = [];
  let cur = new Date(from);
  const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  while (cur <= to) {
    const next = gran === "day"
      ? new Date(cur.getTime() + 864e5)
      : gran === "week"
      ? new Date(cur.getTime() + 7 * 864e5)
      : new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const val = paid
      .filter(e => e.paid_at && new Date(e.paid_at) >= cur && new Date(e.paid_at) < next)
      .reduce((s, e) => s + ttc(e), 0);
    const label = gran === "day"
      ? cur.getDate().toString()
      : gran === "week"
      ? `${cur.getDate()}/${cur.getMonth() + 1}`
      : MONTHS[cur.getMonth()];
    buckets.push({ label, value: val });
    cur = next;
  }
  return buckets;
}

const PERIOD_OPTS: { key: Period; label: string }[] = [
  { key: "today",     label: "Auj."       },
  { key: "7d",        label: "7 jours"    },
  { key: "30d",       label: "30 jours"   },
  { key: "month",     label: "Ce mois"    },
  { key: "lastMonth", label: "Mois préc." },
  { key: "year",      label: "Année"      },
  { key: "custom",    label: "Perso."     },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RevenusView({
  estimates,
  business,
}: {
  estimates: EstimateRow[];
  business: { id: string; name: string; vat_regime: string };
}) {
  const [period, setPeriod]       = useState<Period>("month");
  const [customFrom, setFrom]     = useState("");
  const [customTo,   setTo]       = useState("");
  const [openSections, setOpen]   = useState<Set<string>>(new Set(["paid"]));

  const toggle = (id: string) => setOpen(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const range    = useMemo(() => getRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const prevRng  = useMemo(() => getPrevRange(period, range), [period, range]);

  // ── Filtered datasets ──────────────────────────────────────────────────────
  // CA encaissé: paid_at in range (money received in period)
  const paidInPeriod = useMemo(() =>
    estimates.filter(e => e.status === "paid" && e.paid_at && new Date(e.paid_at) >= range.from && new Date(e.paid_at) <= range.to),
  [estimates, range]);

  // Activity by issued_at
  const issuedInPeriod = useMemo(() =>
    estimates.filter(e => { const d = new Date(e.issued_at); return d >= range.from && d <= range.to; }),
  [estimates, range]);

  // Previous period for trend
  const prevPaid = useMemo(() =>
    estimates.filter(e => e.status === "paid" && e.paid_at && new Date(e.paid_at) >= prevRng.from && new Date(e.paid_at) <= prevRng.to),
  [estimates, prevRng]);

  // All invoiced (not yet paid) — global, not period-filtered (it's an alert)
  const allInvoiced = useMemo(() => estimates.filter(e => e.status === "invoiced"), [estimates]);

  // Accepted estimates in period (devis signed but not yet invoiced)
  const acceptedInPeriod = useMemo(() =>
    issuedInPeriod.filter(e => e.status === "accepted"),
  [issuedInPeriod]);

  // Sent/viewed in period (waiting for acceptance)
  const pendingInPeriod = useMemo(() =>
    issuedInPeriod.filter(e => ["sent", "viewed"].includes(e.status)),
  [issuedInPeriod]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const caEncaisse    = useMemo(() => paidInPeriod.reduce((s, e) => s + ttc(e), 0), [paidInPeriod]);
  const caEncaisseHT  = useMemo(() => paidInPeriod.reduce((s, e) => s + ht(e), 0), [paidInPeriod]);
  const vatTotal      = caEncaisse - caEncaisseHT;

  const caFacture     = useMemo(() =>
    issuedInPeriod.filter(e => ["invoiced", "paid"].includes(e.status)).reduce((s, e) => s + ttc(e), 0),
  [issuedInPeriod]);

  const enAttente     = useMemo(() => pendingInPeriod.reduce((s, e) => s + ttc(e), 0), [pendingInPeriod]);
  const impayeTotal   = useMemo(() => allInvoiced.reduce((s, e) => s + ttc(e), 0), [allInvoiced]);
  const devisAccepte  = useMemo(() => acceptedInPeriod.reduce((s, e) => s + ttc(e), 0), [acceptedInPeriod]);
  const factureMoy    = paidInPeriod.length > 0 ? caEncaisse / paidInPeriod.length : 0;

  // Trend vs previous period
  const prevCA    = useMemo(() => prevPaid.reduce((s, e) => s + ttc(e), 0), [prevPaid]);
  const trend     = prevCA > 0 ? ((caEncaisse - prevCA) / prevCA) * 100 : null;

  // ── Chart ──────────────────────────────────────────────────────────────────
  const gran      = useMemo(() => granularity(range.from, range.to), [range]);
  const chartData = useMemo(() => buildChart(paidInPeriod, range.from, range.to, gran), [paidInPeriod, range, gran]);

  // ── Client breakdown ───────────────────────────────────────────────────────
  const clientBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    paidInPeriod.forEach(e => {
      const key  = e.client?.id ?? "__unknown__";
      const name = e.client?.company_name || e.client?.full_name || "Client inconnu";
      const cur  = map.get(key) ?? { name, total: 0, count: 0 };
      map.set(key, { name: cur.name, total: cur.total + ttc(e), count: cur.count + 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [paidInPeriod]);

  // ── Period label ───────────────────────────────────────────────────────────
  const fmtD = (d: Date) => d.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
  const periodLabel = period === "custom" && customFrom && customTo
    ? `${fmtD(range.from)} – ${fmtD(range.to)}`
    : PERIOD_OPTS.find(p => p.key === period)?.label ?? "";

  const isEmpty = caEncaisse === 0 && caFacture === 0 && enAttente === 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* ── Sticky header with period selector ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-black text-slate-900">Finances</h1>
            <p className="text-xs text-slate-400">{periodLabel}</p>
          </div>
          {trend !== null && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-bold rounded-xl px-2.5 py-1.5",
              trend >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}>
              {trend >= 0
                ? <TrendingUp className="w-3.5 h-3.5" />
                : <TrendingDown className="w-3.5 h-3.5" />}
              {trend >= 0 ? "+" : ""}{trend.toFixed(0)}% vs période préc.
            </div>
          )}
        </div>

        {/* Period tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {PERIOD_OPTS.map(p => (
            <button
              key={p.key}
              onClick={() => { setPeriod(p.key); }}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                period === p.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {period === "custom" && (
          <div className="flex items-center gap-2 mt-2.5">
            <input type="date" value={customFrom} onChange={e => setFrom(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500" />
            <span className="text-xs text-slate-400">→</span>
            <input type="date" value={customTo} onChange={e => setTo(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500" />
          </div>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* ── KPI grid 2×3 ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            label="CA encaissé"
            value={formatCurrency(caEncaisse)}
            sub={`${paidInPeriod.length} paiement${paidInPeriod.length !== 1 ? "s" : ""}`}
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            bg="bg-emerald-50" border="border-emerald-100"
            lc="text-emerald-700" vc="text-emerald-900"
          />
          <KpiCard
            label="CA facturé"
            value={formatCurrency(caFacture)}
            sub={`${issuedInPeriod.filter(e => ["invoiced","paid"].includes(e.status)).length} factures`}
            icon={<FileText className="w-4 h-4 text-blue-600" />}
            bg="bg-blue-50" border="border-blue-100"
            lc="text-blue-700" vc="text-blue-900"
          />
          <KpiCard
            label="Devis en attente"
            value={formatCurrency(enAttente)}
            sub={`${pendingInPeriod.length} devis`}
            icon={<Clock className="w-4 h-4 text-amber-600" />}
            bg="bg-amber-50" border="border-amber-100"
            lc="text-amber-700" vc="text-amber-900"
          />
          <KpiCard
            label="Impayé"
            value={formatCurrency(impayeTotal)}
            sub={`${allInvoiced.length} facture${allInvoiced.length !== 1 ? "s" : ""}`}
            icon={<AlertCircle className={cn("w-4 h-4", impayeTotal > 0 ? "text-red-600" : "text-slate-400")} />}
            bg={impayeTotal > 0 ? "bg-red-50" : "bg-slate-50"}
            border={impayeTotal > 0 ? "border-red-100" : "border-slate-100"}
            lc={impayeTotal > 0 ? "text-red-700" : "text-slate-500"}
            vc={impayeTotal > 0 ? "text-red-900" : "text-slate-700"}
          />
          <KpiCard
            label="Devis acceptés"
            value={formatCurrency(devisAccepte)}
            sub={`${acceptedInPeriod.length} devis`}
            icon={<TrendingUp className="w-4 h-4 text-violet-600" />}
            bg="bg-violet-50" border="border-violet-100"
            lc="text-violet-700" vc="text-violet-900"
          />
          <KpiCard
            label="Facture moyenne"
            value={formatCurrency(factureMoy)}
            sub={paidInPeriod.length > 0 ? `sur ${paidInPeriod.length} fact.` : "Aucune donnée"}
            icon={<BarChart2 className="w-4 h-4 text-slate-500" />}
            bg="bg-slate-50" border="border-slate-100"
            lc="text-slate-500" vc="text-slate-800"
          />
        </div>

        {/* ── HT / TVA / TTC strip ── */}
        {caEncaisse > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Décomposition CA encaissé
            </p>
            <div className="grid grid-cols-3 gap-3 divide-x divide-slate-100">
              <div className="pr-3">
                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">HT</p>
                <p className="text-sm font-black text-slate-700 tabular-nums">{formatCurrency(caEncaisseHT)}</p>
              </div>
              <div className="px-3">
                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">TVA</p>
                <p className="text-sm font-black text-slate-500 tabular-nums">+{formatCurrency(vatTotal)}</p>
              </div>
              <div className="pl-3">
                <p className="text-[10px] text-blue-500 font-semibold mb-0.5">TTC</p>
                <p className="text-sm font-black text-blue-700 tabular-nums">{formatCurrency(caEncaisse)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Evolution chart ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-700">Évolution CA encaissé</p>
            <span className="text-[10px] text-slate-400 font-medium bg-slate-100 rounded-lg px-2 py-0.5">
              par {gran === "day" ? "jour" : gran === "week" ? "semaine" : "mois"}
            </span>
          </div>
          <BarChart data={chartData} />
          {chartData.every(d => d.value === 0) && (
            <p className="text-xs text-slate-400 text-center mt-2">Aucun encaissement sur cette période</p>
          )}
        </div>

        {/* ── Client breakdown ── */}
        {clientBreakdown.length > 0 && (
          <Collapsible id="clients" open={openSections} onToggle={toggle}
            title="Par client" badge={clientBreakdown.length}
            icon={<User className="w-4 h-4 text-slate-500" />}
          >
            <div className="divide-y divide-slate-50">
              {clientBreakdown.slice(0, 8).map((c, i) => {
                const pct = caEncaisse > 0 ? (c.total / caEncaisse) * 100 : 0;
                return (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-blue-700">{c.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(c.total)}</p>
                      <p className="text-[10px] text-slate-400">{c.count} fact.</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Collapsible>
        )}

        {/* ── Factures payées ── */}
        {paidInPeriod.length > 0 && (
          <Collapsible id="paid" open={openSections} onToggle={toggle}
            title="Factures payées" badge={paidInPeriod.length}
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          >
            <EstimateList
              estimates={[...paidInPeriod]
                .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())
                .slice(0, 10)}
              dateField="paid_at"
              valueClass="text-emerald-700"
              prefix="+"
            />
          </Collapsible>
        )}

        {/* ── En attente de paiement ── */}
        {allInvoiced.length > 0 && (
          <Collapsible id="invoiced" open={openSections} onToggle={toggle}
            title="En attente de paiement" badge={allInvoiced.length}
            icon={<AlertCircle className="w-4 h-4 text-red-500" />}
          >
            <EstimateList
              estimates={[...allInvoiced]
                .sort((a, b) => new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime())
                .slice(0, 10)}
              dateField="issued_at"
              valueClass="text-red-700"
              showOverdue
            />
          </Collapsible>
        )}

        {/* ── Devis à fort potentiel ── */}
        {acceptedInPeriod.length > 0 && (
          <Collapsible id="accepted" open={openSections} onToggle={toggle}
            title="Devis acceptés · à facturer" badge={acceptedInPeriod.length}
            icon={<TrendingUp className="w-4 h-4 text-violet-500" />}
          >
            <EstimateList
              estimates={[...acceptedInPeriod]
                .sort((a, b) => ttc(b) - ttc(a))
                .slice(0, 8)}
              dateField="issued_at"
              valueClass="text-violet-700"
            />
          </Collapsible>
        )}

        {/* ── Devis en attente (sent/viewed) ── */}
        {pendingInPeriod.length > 0 && (
          <Collapsible id="pending" open={openSections} onToggle={toggle}
            title="Devis envoyés · réponse attendue" badge={pendingInPeriod.length}
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          >
            <EstimateList
              estimates={[...pendingInPeriod]
                .sort((a, b) => ttc(b) - ttc(a))
                .slice(0, 8)}
              dateField="issued_at"
              valueClass="text-amber-700"
              showExpiry
            />
          </Collapsible>
        )}

        {/* ── Empty state ── */}
        {isEmpty && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BarChart2 className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Aucune donnée sur cette période</p>
            <p className="text-xs text-slate-400">Essayez une période plus large</p>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, bg, border, lc, vc,
}: {
  label: string; value: string; sub: string;
  icon: React.ReactNode;
  bg: string; border: string; lc: string; vc: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-3.5 flex flex-col gap-1.5", bg, border)}>
      <div className="flex items-center justify-between">
        {icon}
      </div>
      <p className={cn("text-[10px] font-bold uppercase tracking-wide", lc)}>{label}</p>
      <p className={cn("text-lg font-black tabular-nums leading-tight", vc)}>{value}</p>
      <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
    </div>
  );
}

// ─── Bar chart (SVG) ──────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return null;
  const max    = Math.max(...data.map(d => d.value), 1);
  const BW     = 14;   // bar width
  const GAP    = 5;    // gap
  const COL    = BW + GAP;
  const CH     = 56;   // chart height
  const LH     = 14;   // label height
  const W      = Math.max(data.length * COL, 240);

  return (
    <div className="overflow-x-auto scrollbar-hide -mx-0.5">
      <svg width={W} height={CH + LH} style={{ display: "block", minWidth: "100%" }}>
        <defs>
          <linearGradient id="bgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const bh = d.value > 0 ? Math.max(3, (d.value / max) * CH) : 0;
          const x  = i * COL + Math.floor((W / data.length - COL) / 2);
          return (
            <g key={i}>
              <rect x={x} y={0} width={BW} height={CH} rx={3} fill="#F1F5F9" />
              {bh > 0 && (
                <rect x={x} y={CH - bh} width={BW} height={bh} rx={3} fill="url(#bgrad)" />
              )}
              <text
                x={x + BW / 2} y={CH + LH - 1}
                textAnchor="middle" fontSize={7} fill="#CBD5E1"
                fontFamily="system-ui, sans-serif"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Collapsible({
  id, open, onToggle, title, badge, icon, children,
}: {
  id: string; open: Set<string>; onToggle: (id: string) => void;
  title: string; badge?: number; icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const isOpen = open.has(id);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <span className="flex-1 text-sm font-bold text-slate-700">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="text-xs font-bold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 mr-1">
            {badge}
          </span>
        )}
        {isOpen
          ? <ChevronDown className="w-4 h-4 text-slate-400" />
          : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {isOpen && <div className="border-t border-slate-50">{children}</div>}
    </div>
  );
}

// ─── Estimate list ────────────────────────────────────────────────────────────

function EstimateList({
  estimates, dateField, valueClass, prefix = "", showOverdue = false, showExpiry = false,
}: {
  estimates: EstimateRow[];
  dateField: "paid_at" | "issued_at";
  valueClass: string;
  prefix?: string;
  showOverdue?: boolean;
  showExpiry?: boolean;
}) {
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });

  return (
    <div className="divide-y divide-slate-50">
      {estimates.map(e => {
        const dateStr  = dateField === "paid_at" ? e.paid_at : e.issued_at;
        const amount   = ttc(e);
        const daysOld  = dateStr ? Math.floor((Date.now() - new Date(dateStr).getTime()) / 864e5) : 0;
        const overdue  = showOverdue && daysOld > 30;
        const expiring = showExpiry && daysOld > 25;

        return (
          <Link
            key={e.id}
            href={`/devis/${e.id}/edit`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {e.client?.company_name || e.client?.full_name || "Sans client"}
                </p>
                {overdue && (
                  <span className="text-[9px] font-bold bg-red-100 text-red-700 rounded-md px-1.5 py-0.5 flex-shrink-0">
                    +{daysOld}j
                  </span>
                )}
                {expiring && !overdue && (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 flex-shrink-0">
                    Expire bientôt
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {e.number || e.title || "Sans titre"}
                {dateStr && ` · ${fmtDate(dateStr)}`}
              </p>
            </div>
            <p className={cn("text-sm font-bold tabular-nums flex-shrink-0", valueClass)}>
              {prefix}{formatCurrency(amount)}
            </p>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        );
      })}
    </div>
  );
}
