"use client";

import { useState } from "react";
import { ArrowLeft, MessageCircle, Phone, Clock, Megaphone, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import type { Client } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InactiveClient extends Client {
  last_estimate_at: string | null;
}

interface RelancesClarteViewProps {
  businessName: string;
  businessPhone: string | null;
  inactiveClients: InactiveClient[];
}

// ── Campaign templates ────────────────────────────────────────────────────────

const CAMPAIGNS = [
  {
    id: "entretien_chaudiere",
    icon: "🔥",
    title: "Entretien chaudière",
    subtitle: "Rappel annuel avant l'hiver",
    color: "bg-orange-50 border-orange-200",
    badgeColor: "bg-orange-100 text-orange-700",
    message: (name: string, businessName: string, phone: string | null) =>
      `Bonjour ${name} 👋\n\nL'automne approche, c'est le bon moment pour l'entretien annuel de votre chaudière !\n\n✅ Entretien complet et contrôle sécurité\n✅ Devis gratuit\n\nContactez-nous pour prendre rendez-vous 📅\n📞 ${phone ?? ""}\n\n${businessName}`,
  },
  {
    id: "rappel_saisonnier",
    icon: "🌿",
    title: "Rappel saisonnier",
    subtitle: "Message personnalisé selon la saison",
    color: "bg-emerald-50 border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-700",
    message: (name: string, businessName: string, phone: string | null) => {
      const month = new Date().getMonth();
      const season = month >= 2 && month <= 4 ? "printemps" : month >= 5 && month <= 7 ? "été" : month >= 8 && month <= 10 ? "automne" : "hiver";
      return `Bonjour ${name} 👋\n\nAvec l'arrivée de l'${season}, c'est le bon moment pour penser à l'entretien de votre installation !\n\n📋 Un devis gratuit ? On se déplace.\n\n📞 ${phone ?? ""}\n\n${businessName}`;
    },
  },
  {
    id: "proposition_entretien",
    icon: "🤝",
    title: "Proposition d'entretien",
    subtitle: "Pour les clients sans nouvelle depuis 6 mois+",
    color: "bg-blue-50 border-blue-200",
    badgeColor: "bg-blue-100 text-blue-700",
    message: (name: string, businessName: string, phone: string | null) =>
      `Bonjour ${name} 👋\n\nComment allez-vous ? Cela fait un moment qu'on ne s'est pas vu !\n\nNous proposons un passage d'entretien préventif — c'est l'occasion de tout vérifier avant que ça devienne urgent 😊\n\n📋 Devis gratuit et sans engagement.\n📞 ${phone ?? ""}\n\n${businessName}`,
  },
  {
    id: "promotion",
    icon: "🎁",
    title: "Offre spéciale clients fidèles",
    subtitle: "Remerciez vos meilleurs clients",
    color: "bg-violet-50 border-violet-200",
    badgeColor: "bg-violet-100 text-violet-700",
    message: (name: string, businessName: string, phone: string | null) =>
      `Bonjour ${name} 👋\n\nMerci pour votre fidélité ! En guise de remerciement, nous vous offrons une réduction de 10% sur votre prochain devis ✨\n\nValable jusqu'à fin du mois — contactez-nous pour en profiter !\n📞 ${phone ?? ""}\n\n${businessName}`,
  },
];

function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default function RelancesClarteView({ businessName, businessPhone, inactiveClients }: RelancesClarteViewProps) {
  const [tab, setTab] = useState<"inactifs" | "campagnes">("inactifs");
  const [campaignModal, setCampaignModal] = useState<typeof CAMPAIGNS[0] | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  const toggleClient = (id: string) =>
    setSelectedClients((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const sendCampaign = () => {
    if (!campaignModal) return;
    const targets = inactiveClients.filter((c) => selectedClients.includes(c.id) && c.phone);
    if (targets.length === 0) return;
    // Send to first — user repeats or we batch manually via WhatsApp
    const client = targets[0];
    const msg = campaignModal.message(client.full_name.split(" ")[0], businessName, businessPhone);
    window.open(`https://wa.me/${client.phone!.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const sendSingle = (client: InactiveClient, campaign: typeof CAMPAIGNS[0]) => {
    if (!client.phone) return;
    const msg = campaign.message(client.full_name.split(" ")[0], businessName, businessPhone);
    window.open(`https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/commercial" className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200 flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-slate-900 leading-tight">Relances Clarté</h1>
          <p className="text-[11px] text-slate-400">Clients inactifs · Campagnes saisonnières</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 px-4 flex gap-4">
        {([
          { id: "inactifs", label: `Clients inactifs${inactiveClients.length > 0 ? ` (${inactiveClients.length})` : ""}` },
          { id: "campagnes", label: "Campagnes" },
        ] as const).map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("py-3 text-sm font-bold border-b-2 transition-colors",
              tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Campaign send modal ────────────────────────────────────────────── */}
      {campaignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <p className="text-base font-black text-slate-900">{campaignModal.icon} {campaignModal.title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Sélectionnez les clients à contacter</p>
            </div>
            <div className="flex flex-col gap-1.5 p-4 max-h-64 overflow-y-auto">
              {inactiveClients.filter((c) => c.phone).map((client) => (
                <button key={client.id} onClick={() => toggleClient(client.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors",
                    selectedClients.includes(client.id) ? "border-blue-400 bg-blue-50" : "border-slate-100 bg-white"
                  )}>
                  <div className={cn("w-5 h-5 rounded-full border-2 flex-shrink-0",
                    selectedClients.includes(client.id) ? "border-blue-500 bg-blue-500" : "border-slate-300"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{client.full_name}</p>
                    <p className="text-[10px] text-slate-400">{client.phone}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-4 pb-5 flex gap-2">
              <button onClick={() => { setCampaignModal(null); setSelectedClients([]); }}
                className="flex-1 h-11 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl">
                Annuler
              </button>
              <button
                onClick={() => { sendCampaign(); setCampaignModal(null); setSelectedClients([]); }}
                disabled={selectedClients.length === 0}
                className="flex-1 h-11 bg-[#25D366] text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Envoyer ({selectedClients.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 py-5 pb-10">

        {/* ── Tab: Clients inactifs ─────────────────────────────────────────── */}
        {tab === "inactifs" && (
          <>
            {inactiveClients.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-sm font-bold text-slate-700">Tous vos clients sont actifs</p>
                <p className="text-xs text-slate-400 mt-1">Aucun client sans activité depuis 3 mois</p>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 rounded-xl px-4 py-3 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    <span className="font-bold">{inactiveClients.length} client{inactiveClients.length > 1 ? "s" : ""}</span> sans devis ni chantier depuis plus de 90 jours.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {inactiveClients.map((client) => {
                    const days = daysSince(client.last_estimate_at);
                    return (
                      <div key={client.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-500">
                          {client.full_name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{client.full_name}</p>
                          <p className="text-[10px] text-slate-400">
                            {days !== null ? `Inactif depuis ${days} jours` : "Jamais de devis"}
                          </p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {client.phone && (
                            <a href={`tel:${client.phone}`}
                              className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center active:bg-emerald-100">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            </a>
                          )}
                          {client.phone && (
                            <button
                              onClick={() => sendSingle(client, CAMPAIGNS[2])}
                              className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center active:bg-blue-100">
                              <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Tab: Campagnes ────────────────────────────────────────────────── */}
        {tab === "campagnes" && (
          <>
            <p className="text-[11px] text-slate-400">
              Choisissez un modèle de campagne et envoyez-le à vos clients inactifs via WhatsApp.
            </p>
            <div className="flex flex-col gap-2">
              {CAMPAIGNS.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => { setCampaignModal(campaign); setSelectedClients([]); }}
                  className={cn("bg-white rounded-2xl border-2 p-4 flex items-center gap-3 text-left active:opacity-80 transition-opacity", campaign.color)}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                    {campaign.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{campaign.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{campaign.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", campaign.badgeColor)}>
                      WhatsApp
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </button>
              ))}
            </div>
            <div className="bg-slate-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-slate-500 leading-snug">
                <span className="font-bold">Prochainement :</span> envoi email, SMS, et campagnes planifiées à l'avance.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
