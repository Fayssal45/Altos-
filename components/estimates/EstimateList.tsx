"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText, Plus, ChevronRight, Eye, Check, Search,
  SlidersHorizontal, X, Euro, MoreHorizontal,
  Copy, Archive, MessageCircle, Send, Pencil, Download, CreditCard,
} from "lucide-react";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG, getEstimateShareUrl, getWhatsAppShareText, formatPhoneForWhatsApp } from "@/lib/utils";
import type { Estimate, Business, EstimateItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";

interface EstimateListProps {
  estimates: Estimate[];
  businessName?: string;
  business?: Business | null;
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
  estimates.forEach((e) => {
    const d = new Date(e.created_at);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthSet.add(m);
  });

  const periods: { key: string; label: string }[] = [{ key: "all", label: "Toutes périodes" }];
  if (monthSet.has(thisMonth)) periods.push({ key: `month:${thisMonth}`, label: "Ce mois" });
  if (monthSet.has(lastMonth)) {
    periods.push({
      key: `month:${lastMonth}`,
      label: new Date(lastMonthDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    });
  }
  Array.from(monthSet).sort((a, b) => b.localeCompare(a))
    .filter((m) => m !== thisMonth && m !== lastMonth)
    .slice(0, 6)
    .forEach((m) => {
      const [y, mo] = m.split("-");
      periods.push({
        key: `month:${m}`,
        label: new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      });
    });
  return periods;
}

export default function EstimateList({ estimates: initialEstimates, businessName, business }: EstimateListProps) {
  const router = useRouter();
  const supabase = createClient();

  // SWR: show SSR data instantly, cache between navigations so re-visits are instant
  const { data: estimates = initialEstimates, mutate: revalidateEstimates } = useSWR<Estimate[]>(
    business?.id ? `estimates-list:${business.id}` : null,
    async () => {
      const { data } = await supabase
        .from("estimates")
        .select("*, client:clients(full_name, phone, company_name, address, city, postal_code)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as Estimate[]) ?? [];
    },
    {
      fallbackData: initialEstimates,  // use SSR data on first render
      revalidateOnMount: true,         // always refresh in background
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,          // show cached data while refreshing
    }
  );

  const [search, setSearch]       = useState("");
  const [status, setStatus]       = useState("all");
  const [period, setPeriod]       = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [actionEstimate, setActionEstimate] = useState<Estimate | null>(null);

  const periods = useMemo(() => buildPeriods(estimates), [estimates]);

  const filtered = useMemo(() => {
    let list = estimates;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => {
        const clientName = (e.client as any)?.full_name?.toLowerCase() || "";
        return e.title?.toLowerCase().includes(q) || e.number?.toLowerCase().includes(q) || clientName.includes(q);
      });
    }
    if (status !== "all") list = list.filter((e) => e.status === status);
    if (period !== "all") {
      const [type, value] = period.split(":");
      list = list.filter((e) => {
        const d = new Date(e.created_at);
        if (type === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === value;
        if (type === "year") return String(d.getFullYear()) === value;
        return true;
      });
    }
    return list;
  }, [estimates, search, status, period]);

  const totalTTC = filtered.reduce((s, e) => s + (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100), 0);
  const activeFilters = (status !== "all" ? 1 : 0) + (period !== "all" ? 1 : 0);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleDuplicate = async (e: Estimate) => {
    setActionEstimate(null);
    try {
      const { data: numData } = await supabase.rpc("generate_estimate_number", {
        p_business_id: e.business_id,
      });
      const { data: newEstimate, error } = await supabase
        .from("estimates")
        .insert({
          business_id: e.business_id,
          client_id: e.client_id,
          number: numData,
          status: "draft",
          title: `${e.title || "Devis"} (copie)`,
          total_amount_ht: e.total_amount_ht,
          vat_rate: e.vat_rate,
          discount: e.discount,
          discount_type: e.discount_type,
          notes: e.notes,
          client_notes: e.client_notes,
          payment_terms: e.payment_terms,
          validity_days: e.validity_days,
          issued_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      // Copy items
      const { data: items } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("estimate_id", e.id)
        .order("sort_order");
      if (items?.length) {
        await supabase.from("estimate_items").insert(
          items.map(({ id: _id, estimate_id: _eid, created_at: _cat, ...item }: EstimateItem) => ({
            ...item,
            estimate_id: newEstimate.id,
          }))
        );
      }

      toast.success("Devis dupliqué !");
      router.push(`/devis/${newEstimate.id}/edit`);
    } catch (err) {
      toast.error("Erreur lors de la duplication");
    }
  };

  const handleMarkPaid = async (e: Estimate) => {
    setActionEstimate(null);
    const paidAt = new Date().toISOString();
    // Optimistic update
    revalidateEstimates((prev) => prev?.map((est) => est.id === e.id ? { ...est, status: "paid" as const, paid_at: paidAt } : est), false);
    const { error } = await supabase
      .from("estimates")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", e.id);
    if (error) { toast.error("Erreur"); revalidateEstimates(); return; }
    toast.success("Marqué comme payé");
  };

  const handleArchive = async (e: Estimate) => {
    setActionEstimate(null);
    // Optimistic update
    revalidateEstimates((prev) => prev?.filter((est) => est.id !== e.id), false);
    const { error } = await supabase
      .from("estimates")
      .update({ status: "archived" })
      .eq("id", e.id);
    if (error) { toast.error("Erreur"); revalidateEstimates(); return; }
    toast.success("Archivé");
  };

  const handleSendPaymentLink = (e: Estimate) => {
    setActionEstimate(null);
    if (e.stripe_payment_link) {
      // Copy to clipboard + open
      navigator.clipboard?.writeText(e.stripe_payment_link).catch(() => {});
      window.open(e.stripe_payment_link, "_blank");
      toast.success("Lien de paiement ouvert");
    } else {
      // Stripe not configured or no link yet
      toast("Activez Stripe dans votre profil pour générer un lien de paiement", { icon: "💳" });
    }
  };

  const handleDownloadPdf = async (e: Estimate) => {
    setActionEstimate(null);
    const toastId = toast.loading("Génération du PDF…");
    try {
      const { data: items } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("estimate_id", e.id)
        .order("sort_order");
      const fullEstimate = { ...e, items: items || [] };
      const client = (e.client as any) || null;
      // Dynamic import — jsPDF only loads when user actually clicks "Download"
      const { generateEstimatePdf } = await import("@/lib/generateEstimatePdf");
      await generateEstimatePdf(fullEstimate, business || null, client);
      toast.success("PDF téléchargé", { id: toastId });
    } catch {
      toast.error("Erreur lors de la génération du PDF", { id: toastId });
    }
  };

  const handleSendWhatsApp = (e: Estimate) => {
    setActionEstimate(null);
    if (!e.share_token) { toast.error("Ce devis n'a pas de lien de partage"); return; }
    const client = e.client as any;
    const totalTTCVal = (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100);
    const text = getWhatsAppShareText(
      client?.full_name || "Client",
      e.title || "votre intervention",
      getEstimateShareUrl(e.share_token),
      businessName || "",
      totalTTCVal
    );
    const phone = client?.phone ? formatPhoneForWhatsApp(client.phone) : null;
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Devis</h1>
          <p className="text-xs text-slate-500">
            {filtered.length} devis · {formatCurrency(totalTTC)} TTC
          </p>
        </div>
        <Link href="/devis/nouveau">
          <Button size="icon"><Plus className="w-5 h-5" /></Button>
        </Link>
      </div>

      {/* Search + filtre */}
      <div className="px-4 pb-2 flex gap-2">
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
            showFilters || activeFilters > 0 ? "bg-blue-600 border-blue-600" : "bg-white border-slate-200"
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
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Statut</p>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                    status === s.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Période</p>
            <div className="flex gap-1.5 flex-wrap">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all",
                    period === p.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {activeFilters > 0 && (
            <button onClick={() => { setStatus("all"); setPeriod("all"); }} className="text-xs text-red-500 font-semibold self-start">
              Effacer les filtres
            </button>
          )}
        </div>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1.5">
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
          filtered.map((estimate) => (
            <EstimateCard
              key={estimate.id}
              estimate={estimate}
              onAction={() => setActionEstimate(estimate)}
            />
          ))
        )}
        <div className="h-4" />
      </div>

      {/* Action sheet */}
      {actionEstimate && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setActionEstimate(null)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-white rounded-t-3xl p-4 pb-safe shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="mb-4">
              <p className="font-black text-slate-900 truncate">{actionEstimate.title || "Sans titre"}</p>
              <p className="text-sm text-slate-400">{actionEstimate.number}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href={`/devis/${actionEstimate.id}/edit`}
                onClick={() => setActionEstimate(null)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100"
              >
                <Pencil className="w-5 h-5 text-slate-500" />
                <span className="font-semibold text-slate-900">Modifier</span>
              </Link>

              {actionEstimate.share_token && (
                <Link
                  href={`/devis/${actionEstimate.id}/envoyer`}
                  onClick={() => setActionEstimate(null)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100"
                >
                  <Send className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-slate-900">Envoyer</span>
                </Link>
              )}

              {actionEstimate.share_token && (actionEstimate.client as any)?.phone && (
                <button
                  onClick={() => handleSendWhatsApp(actionEstimate)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100"
                >
                  <MessageCircle className="w-5 h-5 text-[#25D366]" />
                  <span className="font-semibold text-slate-900">Envoyer sur WhatsApp</span>
                </button>
              )}

              <button
                onClick={() => handleDuplicate(actionEstimate)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100"
              >
                <Copy className="w-5 h-5 text-slate-500" />
                <span className="font-semibold text-slate-900">Dupliquer</span>
              </button>

              {["accepted", "invoiced"].includes(actionEstimate.status) && (
                <button
                  onClick={() => handleSendPaymentLink(actionEstimate)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-blue-50 active:bg-blue-100"
                >
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-700">Lien de paiement</span>
                </button>
              )}

              {!["paid", "archived"].includes(actionEstimate.status) && (
                <button
                  onClick={() => handleMarkPaid(actionEstimate)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-emerald-50 active:bg-emerald-100"
                >
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-700">Marquer comme payé</span>
                </button>
              )}

              <button
                onClick={() => handleDownloadPdf(actionEstimate)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100"
              >
                <Download className="w-5 h-5 text-slate-500" />
                <span className="font-semibold text-slate-900">Télécharger PDF</span>
              </button>

              {actionEstimate.status !== "archived" && (
                <button
                  onClick={() => handleArchive(actionEstimate)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100"
                >
                  <Archive className="w-5 h-5 text-slate-400" />
                  <span className="font-semibold text-slate-500">Archiver</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EstimateCard({ estimate, onAction }: { estimate: Estimate; onAction: () => void }) {
  const cfg = ESTIMATE_STATUS_CONFIG[estimate.status];
  const client = estimate.client as any;
  const totalTTC = (estimate.total_amount_ht || 0) * (1 + (estimate.vat_rate || 20) / 100);

  const dotColors: Record<string, string> = {
    draft:    "bg-slate-300",
    sent:     "bg-blue-500",
    viewed:   "bg-amber-500",
    accepted: "bg-emerald-500",
    paid:     "bg-emerald-600",
    declined: "bg-red-500",
    invoiced: "bg-purple-500",
    archived: "bg-gray-300",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-stretch">
      <Link href={`/devis/${estimate.id}/edit`} className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5">
        {/* Status dot */}
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-0.5", dotColors[estimate.status] ?? "bg-slate-300")} />
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Line 1: title + amount */}
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-slate-900 truncate leading-snug">
              {estimate.title || "Sans titre"}
            </p>
            <span className="text-sm font-black text-slate-900 tabular-nums flex-shrink-0">
              {formatCurrency(totalTTC)}
            </span>
          </div>
          {/* Line 2: client + status badge + date */}
          <div className="flex items-center gap-2 mt-0.5">
            {client ? (
              <span className="text-[11px] text-slate-500 truncate flex-1 min-w-0">
                {client.company_name ? `${client.full_name} · ${client.company_name}` : client.full_name}
              </span>
            ) : (
              <span className="flex-1" />
            )}
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0", cfg.color)}>
              {estimate.status === "viewed"   && <Eye className="w-2.5 h-2.5" />}
              {estimate.status === "accepted" && <Check className="w-2.5 h-2.5" />}
              {estimate.status === "paid"     && <Euro className="w-2.5 h-2.5" />}
              {cfg.label}
            </span>
            <span className="text-[10px] text-slate-400 flex-shrink-0">{formatDate(estimate.issued_at)}</span>
          </div>
        </div>
      </Link>
      {/* 3-dot action */}
      <button
        onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onAction(); }}
        className="px-2.5 flex items-center justify-center border-l border-slate-100 active:bg-slate-50 rounded-r-xl flex-shrink-0"
      >
        <MoreHorizontal className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}
