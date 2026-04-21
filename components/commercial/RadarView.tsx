"use client";

import { useState } from "react";
import { ArrowLeft, Check, ExternalLink, MapPin, Image as ImageIcon, FileText, Clock, Star, MessageSquare } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Checklist simplifiée Google Business ─────────────────────────────────────

interface CheckItem {
  id: string;
  icon: React.ElementType;
  label: string;
  actionLabel: string;
  actionHref: string;
  external: boolean;
}

const CHECKLIST: CheckItem[] = [
  { id: "gb_hours",  icon: Clock,        label: "Horaires à jour",               actionLabel: "Mettre à jour", actionHref: "https://business.google.com", external: true  },
  { id: "gb_photos", icon: ImageIcon,    label: "10+ photos de chantiers",        actionLabel: "Ajouter photos", actionHref: "https://business.google.com", external: true },
  { id: "gb_desc",   icon: FileText,     label: "Description de l'activité",      actionLabel: "Compléter",     actionHref: "https://business.google.com", external: true  },
  { id: "gb_reply",  icon: MessageSquare,label: "Réponses aux derniers avis",      actionLabel: "Répondre",      actionHref: "https://business.google.com", external: true  },
  { id: "gb_reviews",icon: Star,         label: "5+ avis Google obtenus",         actionLabel: "Demander avis", actionHref: "/commercial/reputation",       external: false },
  { id: "altos_logo",icon: MapPin,       label: "Logo et IBAN sur le profil Altos",actionLabel: "Mon profil",   actionHref: "/profil/entreprise",           external: false },
];

// ── Post templates ─────────────────────────────────────────────────────────────

const POST_TEMPLATES = [
  {
    id: "chantier",
    label: "Chantier terminé",
    icon: "🔧",
    text: (name: string) => `✅ Chantier terminé !\n\nNouveau projet réalisé avec soin et professionnalisme.\n\nVous avez un projet similaire ? Contactez ${name} pour un devis gratuit 👇`,
  },
  {
    id: "saison",
    label: "Rappel saisonnier",
    icon: "📅",
    text: (name: string) => `🔔 Rappel de saison !\n\nC'est le bon moment pour vérifier et entretenir vos installations.\n\n✅ Devis gratuit — Intervention rapide\n\nContactez ${name} pour en savoir plus 👇`,
  },
  {
    id: "avis",
    label: "Merci pour vos avis",
    icon: "⭐",
    text: (name: string) => `⭐ Merci pour votre confiance !\n\nVos avis nous aident à nous améliorer et à être trouvés par de nouveaux clients.\n\nMerci de nous faire confiance — à bientôt !\n\n${name}`,
  },
];

interface RadarViewProps {
  business: Business;
  initialChecklist: Record<string, boolean>;
}

export default function RadarView({ business, initialChecklist }: RadarViewProps) {
  const supabase = createClient();
  const [checklist, setChecklist]     = useState<Record<string, boolean>>(initialChecklist);
  const [copiedPost, setCopiedPost]   = useState<string | null>(null);

  const done  = Object.values(checklist).filter(Boolean).length;
  const total = CHECKLIST.length;
  const pct   = Math.round((done / total) * 100);

  const toggle = async (id: string) => {
    const next = { ...checklist, [id]: !checklist[id] };
    setChecklist(next);
    await supabase.from("businesses").update({ visibility_checklist: next }).eq("id", business.id);
  };

  const copyPost = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPost(id);
    setTimeout(() => setCopiedPost(null), 2000);
  };

  const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500";

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/commercial" className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200 flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-slate-900 leading-tight">Google Business</h1>
          <p className="text-[11px] text-slate-400">Présence locale et visibilité</p>
        </div>
        <a
          href="https://business.google.com"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl active:bg-emerald-100"
        >
          Ouvrir <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="flex flex-col gap-5 px-4 py-5 pb-10">

        {/* ── Objectif Top 3 ──────────────────────────────────────────────── */}
        <div className="btn-gradient rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #fff 0%, transparent 60%)" }} />
          <div className="relative">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Objectif</p>
            <p className="text-lg font-black text-white leading-tight">Top 3 local sur Google Maps</p>
            <p className="text-[11px] text-white/70 mt-1 mb-4">dans votre zone d&apos;activité</p>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-1 h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-white font-black text-sm w-10 text-right">{pct}%</span>
            </div>
            <p className="text-[10px] text-white/60">
              {done}/{total} actions complétées
            </p>
          </div>
        </div>

        {/* ── Checklist 6 actions ─────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Liste de contrôle</p>
          <div className="flex flex-col gap-2">
            {CHECKLIST.map((item) => {
              const checked = !!checklist[item.id];
              const Icon = item.icon;
              return (
                <div key={item.id} className={cn(
                  "bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors",
                  checked ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100"
                )}>
                  <button
                    onClick={() => toggle(item.id)}
                    className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      checked ? "bg-emerald-500 border-emerald-500" : "border-slate-300 bg-white"
                    )}
                  >
                    {checked && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                    checked ? "bg-slate-100" : "bg-emerald-50"
                  )}>
                    <Icon className={cn("w-3.5 h-3.5", checked ? "text-slate-300" : "text-emerald-600")} />
                  </div>
                  <p className={cn("flex-1 text-sm font-semibold leading-tight",
                    checked ? "text-slate-400 line-through" : "text-slate-800"
                  )}>
                    {item.label}
                  </p>
                  {!checked && (
                    item.external
                      ? <a href={item.actionHref} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1.5 rounded-lg active:bg-blue-100 flex-shrink-0">
                          {item.actionLabel}<ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                        </a>
                      : <Link href={item.actionHref}
                          className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1.5 rounded-lg active:bg-blue-100 flex-shrink-0">
                          {item.actionLabel}
                        </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Publier un post Google ───────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Publier un post Google</p>
          <p className="text-[11px] text-slate-400 mb-3 leading-snug">
            Les posts Google apparaissent sur votre fiche dans les résultats de recherche. Copiez un modèle et collez-le dans Google Business.
          </p>
          <div className="flex flex-col gap-2">
            {POST_TEMPLATES.map((tpl) => {
              const text = tpl.text(business.name);
              const isCopied = copiedPost === tpl.id;
              return (
                <div key={tpl.id} className="bg-white rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{tpl.icon}</span>
                      <p className="text-sm font-bold text-slate-800">{tpl.label}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyPost(text, tpl.id)}
                        className={cn(
                          "text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors",
                          isCopied ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700 active:bg-slate-200"
                        )}
                      >
                        {isCopied ? "Copié ✓" : "Copier"}
                      </button>
                      <a
                        href="https://business.google.com"
                        target="_blank" rel="noopener noreferrer"
                        className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg active:bg-blue-100"
                      >
                        Publier
                      </a>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 whitespace-pre-line">{text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Raccourci vers Google Business ──────────────────────────────── */}
        <a
          href="https://business.google.com"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-12 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-slate-700 active:bg-slate-50 shadow-sm"
        >
          <ExternalLink className="w-4 h-4 text-slate-400" />
          Ouvrir Google Business Profile
        </a>

      </div>
    </div>
  );
}
