"use client";

import Link from "next/link";
import { Star, Camera, MessageCircle, MapPin, Users, ChevronRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommercialHubProps {
  reviewCount: number;
  googleConfigured: boolean;
  showcaseCount: number;
  pendingEstimatesCount: number;
  inactiveClientCount: number;
  checklistDone: number;
  checklistTotal: number;
}

interface ModuleCardProps {
  href: string;
  icon: React.ElementType;
  gradient: string;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

function ModuleCard({ href, icon: Icon, gradient, title, description, badge, badgeColor = "bg-white/30 text-white" }: ModuleCardProps) {
  return (
    <Link
      href={href}
      className={cn("relative rounded-2xl p-4 flex flex-col gap-3 active:opacity-90 overflow-hidden btn-tactile shadow-sm", gradient)}
    >
      {/* subtle background circle */}
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />

      <div className="flex items-start justify-between gap-2 relative">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ChevronRight className="w-4 h-4 text-white/60 mt-1 flex-shrink-0" />
      </div>

      <div className="relative">
        <p className="text-sm font-black text-white leading-tight">{title}</p>
        <p className="text-[11px] text-white/70 mt-0.5 leading-snug">{description}</p>
      </div>

      {badge && (
        <span className={cn("self-start text-[10px] font-bold px-2.5 py-1 rounded-full relative", badgeColor)}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function CommercialHub({
  reviewCount,
  googleConfigured,
  showcaseCount,
  pendingEstimatesCount,
  inactiveClientCount,
  checklistDone,
  checklistTotal,
}: CommercialHubProps) {
  const relancesCount = pendingEstimatesCount + inactiveClientCount;

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-violet-600" />
          <h1 className="text-lg font-black text-slate-900">Commercial</h1>
        </div>
        <p className="text-[12px] text-slate-400">Développez votre activité et votre réputation</p>
      </div>

      {/* ── 5 modules ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-8 grid grid-cols-2 gap-3">

        {/* 1. Avis Google */}
        <ModuleCard
          href="/commercial/reputation"
          icon={Star}
          gradient="bg-gradient-to-br from-amber-400 to-orange-500"
          title="Avis Google"
          description="Demandez des avis, répondez, suivez votre réputation"
          badge={
            !googleConfigured ? "À configurer"
            : reviewCount > 0 ? `${reviewCount} demande${reviewCount > 1 ? "s" : ""} envoyée${reviewCount > 1 ? "s" : ""}`
            : "Prêt"
          }
          badgeColor={!googleConfigured ? "bg-black/20 text-white/80" : "bg-white/25 text-white"}
        />

        {/* 2. Avant / Après */}
        <ModuleCard
          href="/commercial/chantiers"
          icon={Camera}
          gradient="bg-gradient-to-br from-pink-500 to-rose-600"
          title="Avant / Après"
          description="Photos de chantiers, publications, contenu pour réseaux"
          badge={showcaseCount > 0 ? `${showcaseCount} chantier${showcaseCount > 1 ? "s" : ""}` : "Aucun chantier"}
          badgeColor="bg-white/25 text-white"
        />

        {/* 3. Relances — full width */}
        <div className="col-span-2">
          <ModuleCard
            href="/commercial/relances-clarte"
            icon={MessageCircle}
            gradient="bg-gradient-to-r from-blue-600 to-indigo-600"
            title="Relances clients & devis"
            description="Relancez les devis sans réponse, les clients inactifs, envoyez des rappels saisonniers"
            badge={relancesCount > 0 ? `${relancesCount} à traiter` : "À jour"}
            badgeColor={relancesCount > 0 ? "bg-red-400/80 text-white" : "bg-white/25 text-white"}
          />
        </div>

        {/* 4. Google Business */}
        <ModuleCard
          href="/commercial/radar"
          icon={MapPin}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          title="Google Business"
          description="Posts, fiche, présence locale et visibilité dans les recherches"
          badge={`${checklistDone}/${checklistTotal} actions`}
          badgeColor={checklistDone === checklistTotal ? "bg-white/25 text-white" : "bg-black/20 text-white/80"}
        />

        {/* 5. Parrainage */}
        <ModuleCard
          href="/commercial/parrainage"
          icon={Users}
          gradient="bg-gradient-to-br from-violet-500 to-purple-700"
          title="Parrainage"
          description="Bouche-à-oreille, recommandations, clients qui en parlent autour d'eux"
          badge="Nouveau"
          badgeColor="bg-white/25 text-white"
        />
      </div>
    </div>
  );
}
