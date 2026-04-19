"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Eye, Check, CreditCard, MessageCircle, Download, Copy, Receipt } from "lucide-react";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG, getEstimateShareUrl, getWhatsAppReminderText, formatPhoneForWhatsApp } from "@/lib/utils";
import type { Estimate, EstimateItem, Business, Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
// generateEstimatePdf is dynamically imported on demand to keep the bundle small
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

type FullEstimate = Estimate & {
  client: Client | null;
  items: EstimateItem[];
};

export default function EstimateDetailView({
  estimate,
  business,
}: {
  estimate: FullEstimate;
  business: Business | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const statusConfig = ESTIMATE_STATUS_CONFIG[estimate.status];
  const totalHT = estimate.total_amount_ht || 0;
  const vatAmount = totalHT * (estimate.vat_rate || 20) / 100;
  const totalTTC = totalHT + vatAmount;
  const client = estimate.client;

  const shareUrl = estimate.share_token ? getEstimateShareUrl(estimate.share_token) : "";

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const { generateEstimatePdf } = await import("@/lib/generateEstimatePdf");
      await generateEstimatePdf(estimate, business, client);
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  // Generate invoice PDF — reuses the same PDF generator but labelled as FACTURE
  const handleGenerateInvoice = async () => {
    setInvoiceLoading(true);
    try {
      // Mark estimate as invoiced if not already
      if (estimate.status !== "invoiced" && estimate.status !== "paid") {
        await supabase.from("estimates").update({ status: "invoiced" }).eq("id", estimate.id);
      }
      // Generate PDF with invoice title override
      const invoiceEstimate = {
        ...estimate,
        number: estimate.number?.replace(/^DEV/, "FAC") ?? estimate.number,
        title: `FACTURE – ${estimate.title || "Intervention"}`,
      };
      const { generateEstimatePdf } = await import("@/lib/generateEstimatePdf");
      await generateEstimatePdf(invoiceEstimate as typeof estimate, business, client);
      toast.success("Facture PDF générée !");
    } catch {
      toast.error("Erreur lors de la génération de la facture");
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Duplicate estimate
  const handleDuplicate = async () => {
    if (!business?.id) return;
    setDuplicating(true);
    try {
      const { data: numData } = await supabase.rpc("generate_estimate_number", { p_business_id: business.id });
      const { data: newEst, error } = await supabase
        .from("estimates")
        .insert({
          business_id: business.id,
          client_id: client?.id || null,
          number: numData,
          status: "draft",
          title: `${estimate.title || "Devis"} (copie)`,
          vat_rate: estimate.vat_rate,
          client_notes: estimate.client_notes,
          validity_days: estimate.validity_days,
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + (estimate.validity_days || 30) * 86400000).toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      if (estimate.items?.length) {
        await supabase.from("estimate_items").insert(
          estimate.items.map(({ id: _id, estimate_id: _eid, created_at: _cat, ...item }: EstimateItem & { created_at?: string }) => ({
            ...item,
            estimate_id: newEst.id,
          }))
        );
      }
      toast.success("Devis dupliqué !");
      router.push(`/devis/${newEst.id}/edit`);
    } catch {
      toast.error("Erreur lors de la duplication");
    } finally {
      setDuplicating(false);
    }
  };

  const sendReminder = () => {
    if (!client || !shareUrl) return;
    const text = getWhatsAppReminderText(
      client.full_name,
      estimate.title || "votre intervention",
      shareUrl,
      business?.name || "",
      totalTTC
    );
    const phone = client.phone ? formatPhoneForWhatsApp(client.phone) : null;
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <p className="text-xs font-mono text-slate-400">{estimate.number}</p>
            <h1 className="text-base font-black text-slate-900 leading-tight">{estimate.title || "Sans titre"}</h1>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Client */}
        {client && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-400 font-medium mb-1">Client</p>
            <p className="font-bold text-slate-900">{client.full_name}</p>
            {client.company_name && <p className="text-sm text-slate-500">{client.company_name}</p>}
            {client.phone && <p className="text-sm text-slate-400">{client.phone}</p>}
          </div>
        )}

        {/* Tracking */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400">Émis le</p>
              <p className="font-semibold text-slate-900">{formatDate(estimate.issued_at)}</p>
            </div>
            {estimate.viewed_at && (
              <div>
                <p className="text-slate-400 flex items-center gap-1"><Eye className="w-3 h-3" /> Consulté</p>
                <p className="font-semibold text-slate-900">{formatDate(estimate.viewed_at)}</p>
              </div>
            )}
            {estimate.signed_at && (
              <div>
                <p className="text-slate-400 flex items-center gap-1"><Check className="w-3 h-3" /> Signé</p>
                <p className="font-semibold text-slate-900">{formatDate(estimate.signed_at)}</p>
              </div>
            )}
            {estimate.signed_by_name && (
              <div>
                <p className="text-slate-400">Par</p>
                <p className="font-semibold text-slate-900">{estimate.signed_by_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lignes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {estimate.items.map((item) => {
            if (item.is_section) {
              return (
                <div key={item.id} className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase">{item.description}</p>
                </div>
              );
            }
            const lineTotal = item.quantity * item.unit_price * (1 - item.discount / 100);
            return (
              <div key={item.id} className="px-4 py-3 border-b border-slate-50 last:border-0">
                <div className="flex justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                    <p className="text-xs text-slate-400">{item.quantity} {item.unit} × {formatCurrency(item.unit_price)}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(lineTotal)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totaux */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total HT</span>
            <span className="font-semibold tabular-nums">{formatCurrency(totalHT)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">TVA {estimate.vat_rate}%</span>
            <span className="font-semibold tabular-nums">{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2">
            <span className="font-black text-slate-900">Total TTC</span>
            <span className="text-xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Invoice: generate facture PDF (for accepted/paid) */}
          {["accepted", "invoiced", "paid"].includes(estimate.status) && (
            <Button
              size="lg"
              onClick={handleGenerateInvoice}
              loading={invoiceLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <Receipt className="w-5 h-5" />
              Générer la facture PDF
            </Button>
          )}

          {estimate.status === "accepted" && client?.phone && (
            <Button size="lg" onClick={sendReminder} className="w-full bg-[#25D366]">
              <MessageCircle className="w-5 h-5" />
              Envoyer lien de paiement
            </Button>
          )}
          {["sent", "viewed"].includes(estimate.status) && (
            <Button size="lg" variant="outline" onClick={() => router.push(`/devis/${estimate.id}/envoyer`)} className="w-full">
              <Send className="w-5 h-5" />
              Renvoyer le devis
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            onClick={handleDownloadPdf}
            loading={pdfLoading}
            className="w-full"
          >
            <Download className="w-5 h-5" />
            Télécharger PDF devis
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={handleDuplicate}
            loading={duplicating}
            className="w-full"
          >
            <Copy className="w-5 h-5" />
            Dupliquer ce devis
          </Button>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
