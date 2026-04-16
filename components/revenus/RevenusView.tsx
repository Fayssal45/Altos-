"use client";

import { TrendingUp, Clock, Euro, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface RevenusViewProps {
  paidThisYear: {
    total_amount_ht: number;
    vat_rate: number;
    paid_at: string | null;
    title: string | null;
    number: string | null;
    client: { full_name: string } | null;
  }[];
  pendingEstimates: {
    total_amount_ht: number;
    vat_rate: number;
    status: string;
    title: string | null;
    number: string | null;
  }[];
  paidThisMonth: { total_amount_ht: number; vat_rate: number }[];
}

export default function RevenusView({ paidThisYear, pendingEstimates, paidThisMonth }: RevenusViewProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const monthRevenueTTC = paidThisMonth.reduce(
    (s, e) => s + (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100), 0
  );
  const yearRevenueTTC = paidThisYear.reduce(
    (s, e) => s + (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100), 0
  );
  const pendingAmountHT = pendingEstimates.reduce((s, e) => s + (e.total_amount_ht || 0), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-black text-slate-900">Revenus</h1>
        <p className="text-sm text-slate-500">Votre activité financière</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4">

        {/* Grands chiffres */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-600/30">
            <p className="text-xs text-blue-200 font-medium">Ce mois (TTC)</p>
            <p className="text-2xl font-black tabular-nums mt-1">{formatCurrency(monthRevenueTTC)}</p>
            <p className="text-xs text-blue-200 mt-0.5">{currentMonth}</p>
          </div>
          <div className="bg-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-600/30">
            <p className="text-xs text-emerald-200 font-medium">Année {currentYear} (TTC)</p>
            <p className="text-2xl font-black tabular-nums mt-1">{formatCurrency(yearRevenueTTC)}</p>
            <p className="text-xs text-emerald-200 mt-0.5">{paidThisYear.length} factures</p>
          </div>
        </div>

        {/* CA potentiel */}
        {pendingEstimates.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-bold text-amber-900">CA potentiel à récupérer</p>
            </div>
            <p className="text-3xl font-black text-amber-700 tabular-nums">{formatCurrency(pendingAmountHT)}</p>
            <p className="text-xs text-amber-600 mt-1">
              {pendingEstimates.length} devis en attente (HT) · TTC ≈ {formatCurrency(pendingAmountHT * 1.2)}
            </p>
          </div>
        )}

        {/* Historique */}
        {paidThisYear.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Factures payées {currentYear}
            </h2>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {paidThisYear.slice(0, 20).map((estimate, i) => {
                const ttc = (estimate.total_amount_ht || 0) * (1 + (estimate.vat_rate || 20) / 100);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      i < paidThisYear.length - 1 ? "border-b border-slate-50" : ""
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Euro className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{estimate.title || estimate.number || "—"}</p>
                      <p className="text-xs text-slate-400">
                        {estimate.client?.full_name || "—"}
                        {estimate.paid_at && ` · ${formatDate(estimate.paid_at)}`}
                      </p>
                    </div>
                    <span className="text-sm font-black text-emerald-600 tabular-nums flex-shrink-0">
                      +{formatCurrency(ttc)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {paidThisYear.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Aucune facture payée</p>
              <p className="text-sm text-slate-500 mt-1">Vos revenus apparaîtront ici</p>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
