"use client";

import { useState } from "react";
import { Bell, MessageCircle, Eye, Clock, Check, X, Send } from "lucide-react";
import { formatCurrency, formatDate, getEstimateShareUrl, getWhatsAppReminderText, formatPhoneForWhatsApp } from "@/lib/utils";
import type { Estimate, Reminder, Business, Client } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface RelancesListProps {
  viewedEstimates: (Estimate & { client: Pick<Client, "full_name" | "phone" | "company_name"> | null })[];
  reminders: (Reminder & {
    estimate: { number: string; title: string | null; share_token: string | null } | null;
    client: { full_name: string; phone: string | null } | null;
  })[];
  business: Business | null;
}

export default function RelancesList({ viewedEstimates, reminders, business }: RelancesListProps) {
  const supabase = createClient();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleViewedEstimates = viewedEstimates.filter((e) => !dismissedIds.has(e.id));
  const visibleReminders = reminders.filter((r) => !dismissedIds.has(r.id));

  const sendWhatsAppFollowup = (estimate: Estimate, client: { full_name: string; phone: string | null } | null) => {
    if (!estimate.share_token || !client) return;
    const url = getEstimateShareUrl(estimate.share_token);
    const text = getWhatsAppReminderText(
      client.full_name,
      estimate.title || "votre intervention",
      url,
      business?.name || "Notre entreprise"
    );
    const phone = client.phone?.replace(/\s/g, "").replace(/^0/, "+32");
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  const dismissReminder = async (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    await supabase.from("reminders").update({ status: "dismissed" }).eq("id", id);
  };

  const markReminderSent = async (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    await supabase.from("reminders").update({ status: "sent", last_sent_at: new Date().toISOString() }).eq("id", id);
    toast.success("Relance marquée comme envoyée");
  };

  const totalCount = visibleViewedEstimates.length + visibleReminders.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-black text-slate-900">Relances</h1>
        <p className="text-sm text-slate-500">
          {totalCount === 0 ? "Tout est à jour ✓" : `${totalCount} action${totalCount > 1 ? "s" : ""} à faire`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4">

        {totalCount === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Rien à relancer</p>
              <p className="text-sm text-slate-500 mt-1">Tous vos clients sont à jour</p>
            </div>
          </div>
        )}

        {/* Devis consultés sans réponse */}
        {visibleViewedEstimates.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Devis consultés sans réponse ({visibleViewedEstimates.length})
            </h2>
            <div className="flex flex-col gap-3">
              {visibleViewedEstimates.map((estimate) => {
                const totalTTC = (estimate.total_amount_ht || 0) * (1 + (estimate.vat_rate || 20) / 100);
                const viewedAt = estimate.viewed_at ? formatDate(estimate.viewed_at) : "—";
                const daysSince = estimate.viewed_at
                  ? Math.floor((Date.now() - new Date(estimate.viewed_at).getTime()) / 86400000)
                  : 0;

                return (
                  <div key={estimate.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                    <div className="bg-amber-50 px-4 py-2.5 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">
                        Consulté il y a {daysSince} jour{daysSince > 1 ? "s" : ""}
                      </span>
                      <span className="ml-auto text-xs text-amber-600">{viewedAt}</span>
                    </div>
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs font-mono text-slate-400">{estimate.number}</p>
                          <p className="font-bold text-slate-900">{estimate.title || "Sans titre"}</p>
                          {estimate.client && (
                            <p className="text-sm text-slate-500">{estimate.client.full_name}</p>
                          )}
                        </div>
                        <span className="text-lg font-black text-slate-900 tabular-nums flex-shrink-0">
                          {formatCurrency(totalTTC)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendWhatsAppFollowup(estimate, estimate.client)}
                          className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] rounded-xl py-2.5 text-white text-sm font-bold active:scale-95 transition-transform"
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </button>
                        <a
                          href={`tel:${estimate.client?.phone || ""}`}
                          className="flex items-center justify-center gap-2 bg-slate-100 rounded-xl px-4 py-2.5 text-slate-700 text-sm font-bold active:scale-95 transition-transform"
                        >
                          📞
                        </a>
                        <button
                          onClick={() => dismissReminder(estimate.id)}
                          className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 active:scale-95"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Autres relances */}
        {visibleReminders.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" />
              Autres relances ({visibleReminders.length})
            </h2>
            <div className="flex flex-col gap-3">
              {visibleReminders.map((reminder) => (
                <div key={reminder.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {reminder.estimate && (
                          <p className="text-sm font-bold text-slate-900">
                            {reminder.estimate.number} – {reminder.estimate.title || "Sans titre"}
                          </p>
                        )}
                        {reminder.client && (
                          <p className="text-sm text-slate-500">{reminder.client.full_name}</p>
                        )}
                        {reminder.message && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{reminder.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {reminder.client?.phone && reminder.estimate?.share_token && (
                        <button
                          onClick={() => {
                            const url = getEstimateShareUrl(reminder.estimate!.share_token!);
                            const text = getWhatsAppReminderText(
                              reminder.client!.full_name,
                              reminder.estimate!.title || "votre intervention",
                              url,
                              business?.name || ""
                            );
                            const phone = reminder.client!.phone?.replace(/\s/g, "").replace(/^0/, "+32");
                            window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
                            markReminderSent(reminder.id);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] rounded-xl py-2.5 text-white text-sm font-bold"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Relancer
                        </button>
                      )}
                      <button
                        onClick={() => markReminderSent(reminder.id)}
                        className="flex items-center justify-center gap-2 bg-slate-100 rounded-xl px-4 py-2.5 text-slate-600 text-sm font-bold"
                      >
                        <Check className="w-4 h-4" />
                        Fait
                      </button>
                      <button
                        onClick={() => dismissReminder(reminder.id)}
                        className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
