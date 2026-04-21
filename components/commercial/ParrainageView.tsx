"use client";

import { useState } from "react";
import { ArrowLeft, Users, MessageCircle, Check, Copy, Phone } from "lucide-react";
import Link from "next/link";
import type { Client } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ParrainageViewProps {
  businessName: string;
  businessPhone: string | null;
  clients: Client[];
}

// ── Message templates ────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "recommend",
    icon: "🙏",
    label: "Demande de recommandation",
    sublabel: "Pour un client satisfait",
    text: (clientName: string, bizName: string, phone: string | null) =>
      `Bonjour ${clientName} 👋\n\nJ'espère que tout se passe bien depuis notre intervention !\n\nSi vous êtes satisfait(e) de notre travail, parlez de nous autour de vous — c'est notre meilleure publicité 😊\n\nSi quelqu'un dans votre entourage a besoin d'un artisan, n'hésitez pas à lui donner mon contact :\n📞 ${phone ?? ""}\n\nMerci d'avance !\n${bizName}`,
  },
  {
    id: "thanks",
    icon: "⭐",
    label: "Remerciement + bouche-à-oreille",
    sublabel: "Après un chantier réussi",
    text: (clientName: string, bizName: string, phone: string | null) =>
      `Bonjour ${clientName} 👋\n\nMerci encore pour votre confiance ! C'était un plaisir de travailler pour vous.\n\nSi vous connaissez quelqu'un qui cherche un artisan sérieux, voici mon contact :\n📞 ${phone ?? ""}\n\nUn mot de votre part, c'est la meilleure façon de m'aider à développer mon activité. Merci ! 🙏\n\n${bizName}`,
  },
];

export default function ParrainageView({ businessName, businessPhone, clients }: ParrainageViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [selectedClient, setSelectedClient]     = useState("");
  const [copied, setCopied]                     = useState(false);

  const template = TEMPLATES.find((t) => t.id === selectedTemplate) ?? TEMPLATES[0];
  const client   = clients.find((c) => c.id === selectedClient);
  const message  = template.text(
    client?.full_name ?? "cher client",
    businessName,
    businessPhone
  );

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappUrl = client?.phone
    ? `https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/commercial" className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200 flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-base font-black text-slate-900 leading-tight">Parrainage</h1>
          <p className="text-[11px] text-slate-400">Bouche-à-oreille et recommandations</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 py-5 pb-10">

        {/* ── Intro ────────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-base font-black text-white leading-tight">Le bouche-à-oreille, ça marche</p>
              <p className="text-[11px] text-white/70">1 client satisfait = 3 clients potentiels</p>
            </div>
          </div>
          <p className="text-[12px] text-white/80 leading-relaxed">
            Envoyez un message simple à vos clients satisfaits pour leur demander de vous recommander autour d&apos;eux.
          </p>
        </div>

        {/* ── Choisir le modèle ────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Modèle de message</p>
          <div className="flex flex-col gap-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl.id)}
                className={cn(
                  "flex items-center gap-3 bg-white rounded-xl border-2 px-4 py-3 text-left transition-colors",
                  selectedTemplate === tpl.id ? "border-violet-400 bg-violet-50" : "border-slate-100"
                )}
              >
                <span className="text-xl flex-shrink-0">{tpl.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold leading-tight",
                    selectedTemplate === tpl.id ? "text-violet-700" : "text-slate-800"
                  )}>
                    {tpl.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{tpl.sublabel}</p>
                </div>
                {selectedTemplate === tpl.id && (
                  <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Choisir un client ────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Choisir un client</p>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl text-sm px-3 focus:outline-none focus:border-violet-400 text-slate-700"
          >
            <option value="">Choisir un client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}{c.phone ? "" : " (pas de téléphone)"}
              </option>
            ))}
          </select>
        </div>

        {/* ── Aperçu du message ────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aperçu du message</p>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{message}</p>
          </div>
        </div>

        {/* ── Envoyer ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank" rel="noopener noreferrer"
              className="w-full h-12 bg-[#25D366] text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm active:opacity-90"
            >
              <MessageCircle className="w-4 h-4" />
              Envoyer via WhatsApp
            </a>
          ) : client && !client.phone ? (
            <div className="flex items-center gap-2 bg-amber-50 rounded-xl p-3">
              <Phone className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-[11px] text-amber-700">Ce client n&apos;a pas de numéro de téléphone.</p>
            </div>
          ) : null}

          <button
            onClick={copyMessage}
            disabled={!selectedClient}
            className={cn(
              "w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-40",
              copied ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700 active:bg-slate-200"
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copié !" : "Copier le message"}
          </button>
        </div>

        {/* ── Astuce ───────────────────────────────────────────────────────── */}
        <div className="bg-slate-100 rounded-2xl p-4">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-bold">Astuce :</span> Envoyez ce message 3 à 5 jours après la fin d&apos;un chantier, quand le client est encore satisfait. C&apos;est le meilleur moment pour demander une recommandation.
          </p>
        </div>

      </div>
    </div>
  );
}
