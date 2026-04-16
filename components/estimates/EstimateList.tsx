"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText, Plus, ChevronRight, Eye, Check, Search,
  SlidersHorizontal, X, MapPin, Camera, Euro
} from "lucide-react";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG } from "@/lib/utils";
import type { Estimate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EstimateListProps {
  estimates: Estimate[];
}

const STATUS_OPTIONS = [
  { key: "all",      label: "Tous" },
  { key: "draft",    label: "Brouillons" },
  { key: "sent",     label: "Envoyés" },
  { key: "viewed",   label: "Consultés" },
  { key: "accepted", label: "Acceptés" },
  { key: "paid",     label: "Payés" },
  { key: "declined", label: "Refusés" },
];

function buildPeriods(estimates: Estimate[]) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const monthSet = new Set<string>();
  const yearSet = new Set<string>();
  estimates.forEach((e) => {
    const d = new Date(e.created_at);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthSet.add(m);
    yearSet.add(String(d.getFullYear()));
  });

  const periods: { key: string; label: string }[] = [{ key: "all", label: "Toutes périodes" }];

  if (monthSet.has(thisMonth)) {
    periods.push({ key: `month:${thisMonth}`, label: "Ce mois" });
  }
  if (monthSet.has(lastMonth)) {
    const d = new Date(lastMonthDate);
    periods.push({
      key: `month:${lastMonth}`,
      label: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    });
  }

  // Autres mois
  Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a))
    .filter((m) => m !== thisMonth && m !== lastMonth)
    .slice(0, 6)
    .forEach((m) => {
      const [y, mo] = m.split("-");
      const d = new Date(parseInt(y), parseInt(mo) - 1);
      periods.push({
        key: `month:${m}`,
        label: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      });
    });

  // Années
  Array.from(yearSet)
    .sort((a, b) => b.localeCompare(a))
    .forEach((y) => {
      periods.push({ key: `year:${y}`, label: y });
    });

  return periods;
}

export default function EstimateList({ estimates }: EstimateListProps) {
  const [search, setSearch]       = useState("");
  const [status, setStatus]       = useState("all");
  const [period, setPeriod]       = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const periods = useMemo(() => buildPeriods(estimates), [estimates]);

  const filtered = useMemo(() => {
    let list = estimates;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => {
        const clientName = (e.client as any)?.full_name?.toLowerCase() || "";
        return (
          e.title?.toLowerCase().includes(q) ||
          e.number?.toLowerCase().includes(q) ||
          clientName.includes(q)
        );
      });
    }

    if (status !== "all") {
      list = list.filter((e) => e.status === status);
    }

    if (period !== "all") {
      const [type, value] = period.split(":");
      list = list.filter((e) => {
        const d = new Date(e.created_at);
        if (type === "month") {
          const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return m === value;
        }
        if (type === "year") {
          return String(d.getFullYear()) === value;
        }
        return true;
      });
    }

    return list;
  }, [estimates, search, status, period]);

  const totalTTC = filtered.reduce(
    (s, e) => s + (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100),
    0
  );

  const activeFilters = (status !== "all" ? 1 : 0) + (period !== "all" ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Devis</h1>
          <p className="text-sm text-slate-500">
            {filtered.length} devis · {formatCurrency(totalTTC)} TTC
          </p>
        </div>
        <Link href="/devis/nouveau">
          <Button size="icon"><Plus className="w-5 h-5" /></Button>
        </Link>
      </div>

      {/* Search + filtre */}
      <div className="px-4 pb-3 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client, titre, numéro…"
            className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center border-2 transition-colors relative flex-shrink-0",
            showFilters || activeFilters > 0
              ? "bg-blue-600 border-blue-600"
              : "bg-white border-slate-200"
          )}
        >
          <SlidersHorizontal className={cn("w-4 h-4", showFilters || activeFilters > 0 ? "text-white" : "text-slate-500")} />
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Panneau filtres */}
      {showFilters && (
        <div className="px-4 pb-3 flex flex-col gap-3">
          {/* Statut */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Statut</p>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                    status === s.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Période</p>
            <div className="flex gap-1.5 flex-wrap">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all",
                    period === p.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {activeFilters > 0 && (
            <button
              onClick={() => { setStatus("all"); setPeriod("all"); }}
              className="text-xs text-red-500 font-semibold self-start"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Aucun devis</p>
              <p className="text-sm text-slate-400 mt-1">
                {search || activeFilters > 0 ? "Modifiez vos filtres" : "Créez votre premier devis en 2 min"}
              </p>
            </div>
            {!search && !activeFilters && (
              <Link href="/devis/nouveau">
                <Button><Plus className="w-4 h-4" /> Nouveau Devis</Button>
              </Link>
            )}
          </div>
        ) : (
          filtered.map((estimate) => <EstimateCard key={estimate.id} estimate={estimate} />)
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}

function EstimateCard({ estimate }: { estimate: Estimate }) {
  const cfg = ESTIMATE_STATUS_CONFIG[estimate.status];
  const client = estimate.client as any;
  const totalTTC = (estimate.total_amount_ht || 0) * (1 + (estimate.vat_rate || 20) / 100);

  const statusColors: Record<string, string> = {
    draft:    "bg-slate-100 border-slate-200",
    sent:     "bg-blue-50 border-blue-100",
    viewed:   "bg-amber-50 border-amber-100",
    accepted: "bg-green-50 border-green-100",
    declined: "bg-red-50 border-red-100",
    paid:     "bg-emerald-50 border-emerald-100",
    invoiced: "bg-purple-50 border-purple-100",
    archived: "bg-gray-50 border-gray-100",
  };

  return (
    <Link href={`/devis/${estimate.id}/edit`}>
      <div className={cn(
        "bg-white rounded-2xl border shadow-sm p-4 active:scale-[0.98] transition-transform",
        statusColors[estimate.status] || "border-slate-100"
      )}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-base leading-tight truncate">
              {estimate.title || "Sans titre"}
            </p>
            {client && (
              <p className="text-sm text-slate-500 truncate mt-0.5">
                {client.company_name ? `${client.full_name} · ${client.company_name}` : client.full_name}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-lg font-black text-slate-900 tabular-nums leading-none">
              {formatCurrency(totalTTC)}
            </span>
            <span className="text-[10px] text-slate-400">TTC</span>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", cfg.color)}>
            {estimate.status === "viewed"   && <Eye className="w-3 h-3" />}
            {estimate.status === "accepted" && <Check className="w-3 h-3" />}
            {estimate.status === "paid"     && <Euro className="w-3 h-3" />}
            {cfg.label}
          </span>
          <span className="text-xs text-slate-400">{estimate.number || "—"}</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">{formatDate(estimate.issued_at)}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto" />
        </div>
      </div>
    </Link>
  );
}
