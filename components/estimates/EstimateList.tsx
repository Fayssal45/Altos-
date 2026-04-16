"use client";

import Link from "next/link";
import { FileText, Plus, ChevronRight, Eye, Check } from "lucide-react";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG } from "@/lib/utils";
import type { Estimate } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface EstimateListProps {
  estimates: Estimate[];
}

const STATUS_TABS = [
  { key: "all", label: "Tous" },
  { key: "draft", label: "Brouillons" },
  { key: "sent", label: "Envoyés" },
  { key: "viewed", label: "Consultés" },
  { key: "accepted", label: "Acceptés" },
  { key: "paid", label: "Payés" },
];

export default function EstimateList({ estimates }: EstimateListProps) {
  const [activeTab, setActiveTab] = useState("all");

  const filtered = activeTab === "all"
    ? estimates
    : estimates.filter((e) => e.status === activeTab);

  const totalHT = filtered.reduce((s, e) => s + (e.total_amount_ht || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Devis</h1>
          <p className="text-sm text-slate-500">{filtered.length} devis · {formatCurrency(totalHT)} HT</p>
        </div>
        <Link href="/devis/nouveau">
          <Button size="icon">
            <Plus className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1 opacity-60">
                  ({estimates.filter((e) => e.status === tab.key).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Aucun devis</p>
              <p className="text-sm text-slate-500 mt-1">Créez votre premier devis en 2 minutes</p>
            </div>
            <Link href="/devis/nouveau">
              <Button>
                <Plus className="w-4 h-4" />
                Nouveau Devis
              </Button>
            </Link>
          </div>
        ) : (
          filtered.map((estimate) => (
            <EstimateCard key={estimate.id} estimate={estimate} />
          ))
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}

function EstimateCard({ estimate }: { estimate: Estimate }) {
  const statusConfig = ESTIMATE_STATUS_CONFIG[estimate.status];
  const client = estimate.client as unknown as { full_name: string; company_name?: string } | null;
  const totalTTC = (estimate.total_amount_ht || 0) * (1 + (estimate.vat_rate || 20) / 100);

  return (
    <Link href={`/devis/${estimate.id}/edit`}>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 active:scale-98 transition-transform">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-400">{estimate.number || "DEV-????"}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusConfig.color}`}>
                {estimate.status === "viewed" && <Eye className="w-3 h-3 mr-1" />}
                {estimate.status === "accepted" && <Check className="w-3 h-3 mr-1" />}
                {statusConfig.label}
              </span>
            </div>
            <p className="font-bold text-slate-900 text-base leading-tight truncate">
              {estimate.title || "Sans titre"}
            </p>
            {client && (
              <p className="text-sm text-slate-500 mt-0.5 truncate">
                {client.company_name ? `${client.full_name} · ${client.company_name}` : client.full_name}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">{formatDate(estimate.issued_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-lg font-black text-slate-900 tabular-nums">
              {formatCurrency(totalTTC)}
            </span>
            <span className="text-xs text-slate-400">TTC</span>
            <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}
