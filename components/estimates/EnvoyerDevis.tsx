"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency, getEstimateShareUrl, getWhatsAppReminderText } from "@/lib/utils";
import type { Business, Estimate, Client } from "@/lib/types";
import { ArrowLeft, MessageCircle, Mail, Link2, Copy, Check, Share2 } from "lucide-react";
import toast from "react-hot-toast";

interface EnvoyerDevisProps {
  estimate: Estimate & { client: Client | null };
  business: Business | null;
}

export default function EnvoyerDevis({ estimate, business }: EnvoyerDevisProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const shareUrl = estimate.share_token
    ? getEstimateShareUrl(estimate.share_token)
    : "";

  const client = estimate.client;
  const totalTTC = (estimate.total_amount_ht || 0) * (1 + (estimate.vat_rate || 20) / 100);

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const text = getWhatsAppReminderText(
      client?.full_name || "Client",
      estimate.title || "votre chantier",
      shareUrl,
      business?.name || "Notre entreprise"
    );
    const phone = client?.phone?.replace(/\s/g, "").replace(/^0/, "+33");
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const shareViaSMS = () => {
    const text = `Bonjour ${client?.full_name || ""}, voici votre devis : ${shareUrl}`;
    window.location.href = `sms:${client?.phone || ""}?body=${encodeURIComponent(text)}`;
  };

  const shareViaEmail = () => {
    const subject = `Devis ${estimate.number} – ${estimate.title || ""}`;
    const body = `Bonjour ${client?.full_name || ""},\n\nVeuillez trouver votre devis en cliquant sur ce lien :\n${shareUrl}\n\nCordialement,\n${business?.name || ""}`;
    window.location.href = `mailto:${client?.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Devis ${estimate.number}`,
        text: `${business?.name} vous a envoyé un devis : ${estimate.title}`,
        url: shareUrl,
      });
    } else {
      copyLink();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h1 className="text-lg font-black text-slate-900">Envoyer le devis</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Récap devis */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-mono text-slate-400">{estimate.number}</span>
              <p className="text-lg font-black text-slate-900 mt-0.5">{estimate.title || "Sans titre"}</p>
              {client && (
                <p className="text-sm text-slate-500 mt-1">Pour : {client.full_name}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</p>
              <p className="text-xs text-slate-400">TTC</p>
            </div>
          </div>
        </div>

        {/* Lien magic */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-sm font-bold text-slate-700 mb-2">Lien de partage</p>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="flex-1 text-sm text-slate-600 truncate font-mono">{shareUrl}</span>
            <button onClick={copyLink} className="flex-shrink-0">
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Le client pourra signer et payer directement via ce lien
          </p>
        </div>

        {/* Boutons de partage */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Envoyer via</p>

          <button
            onClick={shareViaWhatsApp}
            className="flex items-center gap-4 bg-[#25D366] rounded-2xl px-5 py-4 text-white active:scale-95 transition-transform shadow-lg shadow-green-500/30"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base">WhatsApp</p>
              <p className="text-xs text-white/70">Recommandé – Taux d'ouverture 95%</p>
            </div>
          </button>

          <button
            onClick={shareViaSMS}
            className="flex items-center gap-4 bg-blue-600 rounded-2xl px-5 py-4 text-white active:scale-95 transition-transform shadow-lg shadow-blue-600/30"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base">SMS</p>
              <p className="text-xs text-white/70">Simple et universel</p>
            </div>
          </button>

          <button
            onClick={shareViaEmail}
            className="flex items-center gap-4 bg-slate-700 rounded-2xl px-5 py-4 text-white active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base">Email</p>
              <p className="text-xs text-white/70">Avec message pré-rédigé</p>
            </div>
          </button>

          <button
            onClick={nativeShare}
            className="flex items-center gap-4 bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-700 active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-5 h-5 text-slate-600" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base text-slate-900">Autre</p>
              <p className="text-xs text-slate-400">Messenger, Telegram…</p>
            </div>
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
