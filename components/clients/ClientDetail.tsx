"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Edit2,
  MessageCircle, Navigation, Zap, Plus,
} from "lucide-react";
import NavigationSheet from "@/components/ui/NavigationSheet";
import MessageSheet from "@/components/ui/MessageSheet";
import type { Client, Estimate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const PRESET_TAGS = [
  { label: "Bon client",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { label: "VIP",         color: "bg-amber-100 text-amber-700 border-amber-200" },
  { label: "À relancer",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  { label: "Impayé",      color: "bg-red-100 text-red-700 border-red-200" },
];

function tagColor(tag: string) {
  return PRESET_TAGS.find((t) => t.label === tag)?.color || "bg-slate-100 text-slate-600 border-slate-200";
}

interface ClientDetailProps {
  client: Client;
  estimates: Pick<Estimate, "id" | "number" | "title" | "status" | "total_amount_ht" | "vat_rate" | "created_at">[];
  jobsCount: number;
  lastActivity: string | null;
}

export default function ClientDetail({ client, estimates, jobsCount, lastActivity }: ClientDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tags, setTags] = useState<string[]>(client.tags || []);
  const [savingTags, setSavingTags] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const totalCA = estimates
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100), 0);

  const phone = client.phone?.replace(/[\s\-\.]/g, "").replace(/^0/, "+32") || "";

  const toggleTag = async (tag: string) => {
    const newTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setTags(newTags);
    setSavingTags(true);
    const { error } = await supabase
      .from("clients")
      .update({ tags: newTags })
      .eq("id", client.id);
    setSavingTags(false);
    if (error) toast.error("Erreur lors de la mise à jour");
  };

  const address = [client.address, client.postal_code, client.city].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-slate-900 leading-tight">{client.full_name}</h1>
            {client.company_name && <p className="text-xs text-slate-400">{client.company_name}</p>}
          </div>
          <Link href={`/clients/${client.id}/edit`}>
            <button className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Edit2 className="w-4 h-4 text-slate-600" />
            </button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {/* Avatar + stats */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-black">{client.full_name[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-slate-900">{client.full_name}</p>
              {client.company_name && (
                <p className="text-sm text-slate-500">{client.company_name}</p>
              )}
              {lastActivity && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Dernier contact : {formatDate(lastActivity)}
                </p>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50 rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 text-center">
              <p className="text-lg font-black text-slate-900 tabular-nums">{estimates.length}</p>
              <p className="text-[10px] text-slate-400 font-medium">Devis</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-lg font-black text-slate-900 tabular-nums">{jobsCount}</p>
              <p className="text-[10px] text-slate-400 font-medium">Interventions</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-sm font-black text-emerald-600 tabular-nums leading-tight">
                {totalCA > 0 ? formatCurrency(totalCA) : "–"}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">CA payé</p>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Étiquettes {savingTags && <span className="font-normal normal-case">· enregistrement…</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map((t) => (
              <button
                key={t.label}
                onClick={() => toggleTag(t.label)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                  tags.includes(t.label)
                    ? t.color
                    : "bg-white text-slate-400 border-slate-200"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-2 gap-2.5">
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex items-center justify-center gap-2 bg-blue-600 rounded-2xl py-3.5 text-white font-bold text-sm shadow-lg shadow-blue-600/20"
            >
              <Phone className="w-4 h-4" />
              Appeler
            </a>
          )}
          {client.phone && (
            <button
              onClick={() => setMsgOpen(true)}
              className="flex items-center justify-center gap-2 bg-[#25D366] rounded-2xl py-3.5 text-white font-bold text-sm shadow-lg shadow-green-500/20"
            >
              <MessageCircle className="w-4 h-4" />
              Message
            </button>
          )}
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="flex items-center justify-center gap-2 bg-slate-700 rounded-2xl py-3.5 text-white font-bold text-sm"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>
          )}
          {address && (
            <button
              onClick={() => setNavOpen(true)}
              className="flex items-center justify-center gap-2 bg-sky-500 rounded-2xl py-3.5 text-white font-bold text-sm shadow-lg shadow-sky-500/20"
            >
              <Navigation className="w-4 h-4" />
              Itinéraire
            </button>
          )}
        </div>

        {/* Créer rapidement */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href={`/devis/nouveau?client_id=${client.id}`}
            className="flex items-center justify-center gap-2 bg-white border-2 border-blue-200 rounded-2xl py-3 text-blue-700 font-bold text-sm"
          >
            <FileText className="w-4 h-4" />
            Nouveau devis
          </Link>
          <Link
            href={`/interventions/nouveau?client_id=${client.id}`}
            className="flex items-center justify-center gap-2 bg-white border-2 border-amber-200 rounded-2xl py-3 text-amber-700 font-bold text-sm"
          >
            <Zap className="w-4 h-4" />
            Intervention
          </Link>
        </div>

        {/* Infos de contact */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
          {client.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-700">{client.phone}</span>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-700">{client.email}</span>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-slate-700">{address}</span>
            </div>
          )}
          {client.notes && (
            <div className="border-t border-slate-50 pt-3">
              <p className="text-xs text-slate-400 font-medium mb-1">Notes</p>
              <p className="text-sm text-slate-700">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Devis */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Devis ({estimates.length})
            </h2>
            <Link href={`/devis/nouveau?client_id=${client.id}`}>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4" />
                Nouveau
              </Button>
            </Link>
          </div>

          {estimates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucun devis pour ce client</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {estimates.map((estimate, i) => {
                const statusConfig = ESTIMATE_STATUS_CONFIG[estimate.status];
                const ttc = (estimate.total_amount_ht || 0) * (1 + (estimate.vat_rate || 20) / 100);
                return (
                  <Link
                    key={estimate.id}
                    href={`/devis/${estimate.id}/edit`}
                    className={`flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 ${i < estimates.length - 1 ? "border-b border-slate-50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{estimate.title || estimate.number || "Sans titre"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        <span className="text-xs text-slate-400">{formatDate(estimate.created_at)}</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(ttc)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>

      {navOpen && address && (
        <NavigationSheet address={address} onClose={() => setNavOpen(false)} />
      )}
      {msgOpen && phone && (
        <MessageSheet
          phone={phone}
          clientName={client.full_name}
          onClose={() => setMsgOpen(false)}
        />
      )}
    </div>
  );
}
