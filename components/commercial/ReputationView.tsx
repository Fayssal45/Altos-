"use client";

import { useState } from "react";
import { Star, Send, ArrowLeft, Check, Info, ExternalLink, MessageSquare, Copy, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import type { Business, Client, ReviewRequest, ReviewAutoTrigger } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReputationViewProps {
  business: Business;
  clients: Client[];
  requests: ReviewRequest[];
}

function SectionTitle({ label }: { label: string }) {
  return <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</p>;
}

export default function ReputationView({ business, clients, requests }: ReputationViewProps) {
  const supabase = createClient();

  const [reviewUrl, setReviewUrl]   = useState(business.google_review_url ?? "");
  const [trigger, setTrigger]       = useState<ReviewAutoTrigger>(business.review_auto_trigger ?? "none");
  const [savingConfig, setSaving]   = useState(false);
  const [selectedClient, setClient] = useState("");
  const [sending, setSending]       = useState(false);

  // AI response generator
  const [aiReviewText, setAiReviewText] = useState("");
  const [aiResponse, setAiResponse]     = useState("");
  const [aiCopied, setAiCopied]         = useState(false);
  const [showAiModal, setShowAiModal]   = useState(false);

  const generateAiResponse = () => {
    const review = aiReviewText.trim().toLowerCase();
    const name = business.name ?? "l'équipe";
    let response = "";

    if (review.length === 0) return;

    // Detect sentiment from keywords
    const positive = ["super", "excellent", "parfait", "très bien", "top", "génial", "bravo", "merci", "rapide", "professionnel", "sérieux", "recommande"];
    const negative = ["décevant", "mauvais", "problème", "délai", "cher", "pas satisfait", "nul", "horrible", "déçu", "attendre"];
    const isPositive = positive.some((w) => review.includes(w));
    const isNegative = negative.some((w) => review.includes(w));

    if (isNegative) {
      response = `Bonjour,\n\nMerci d'avoir pris le temps de partager votre expérience. Nous sommes sincèrement désolés que notre prestation n'ait pas été à la hauteur de vos attentes.\n\nNous prenons vos remarques très au sérieux et nous allons tout mettre en œuvre pour améliorer notre service. N'hésitez pas à nous contacter directement pour que nous puissions trouver une solution ensemble.\n\nCordialement,\n${name}`;
    } else if (isPositive) {
      response = `Bonjour,\n\nMerci beaucoup pour ce retour qui nous touche vraiment ! Votre satisfaction est notre priorité et c'est très motivant de savoir que notre travail est apprécié.\n\nNous serons ravis de vous accueillir à nouveau pour vos prochains projets. N'hésitez pas à nous recommander autour de vous !\n\nCordialement,\n${name}`;
    } else {
      response = `Bonjour,\n\nMerci pour votre avis et la confiance que vous nous accordez. Nous sommes heureux d'avoir pu vous accompagner dans votre projet.\n\nNous restons disponibles pour tout futur besoin. Au plaisir de vous retrouver !\n\nCordialement,\n${name}`;
    }

    setAiResponse(response);
  };

  const copyAiResponse = async () => {
    await navigator.clipboard.writeText(aiResponse);
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 2000);
  };

  // Funnel stats
  const sent    = requests.length;
  const clicked = requests.filter((r) => r.clicked_at).length;
  const obtained = requests.filter((r) => r.obtained_at).length;

  const saveConfig = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({ google_review_url: reviewUrl || null, review_auto_trigger: trigger })
      .eq("id", business.id);
    setSaving(false);
    if (error) toast.error("Erreur lors de la sauvegarde");
    else toast.success("Configuration sauvegardée");
  };

  const sendRequest = async () => {
    if (!selectedClient || !reviewUrl) return;
    const client = clients.find((c) => c.id === selectedClient);
    if (!client?.phone) { toast.error("Ce client n'a pas de numéro de téléphone"); return; }

    setSending(true);
    // Track in DB
    const { error } = await supabase.from("review_requests").insert({
      business_id: business.id,
      client_id: client.id,
      channel: "whatsapp",
    });
    setSending(false);

    if (error) { toast.error("Erreur lors de l'enregistrement"); return; }

    const msg = encodeURIComponent(
      `Bonjour ${client.full_name} 👋\n\nMerci pour votre confiance !\nSi vous êtes satisfait(e) de nos services, un avis Google nous aiderait beaucoup 🙏\n\n👉 ${reviewUrl}\n\nMerci d'avance !`
    );
    window.open(`https://wa.me/${client.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
    toast.success("Demande envoyée via WhatsApp !");
    setClient("");
  };

  const markClicked = async (reqId: string) => {
    await supabase.from("review_requests").update({ clicked_at: new Date().toISOString() }).eq("id", reqId);
    toast.success("Marqué comme cliqué");
  };

  const markObtained = async (reqId: string) => {
    await supabase.from("review_requests").update({ obtained_at: new Date().toISOString() }).eq("id", reqId);
    toast.success("Marqué comme obtenu !");
  };

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* ── AI Response Modal ─────────────────────────────────────────────── */}
      {showAiModal && aiResponse && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-black text-slate-900">Réponse suggérée</p>
              <button onClick={() => setShowAiModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-4 max-h-64 overflow-y-auto">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
            </div>
            <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3 mb-4">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-snug">
                Personnalisez cette réponse avant de la coller dans Google Business Profile.
              </p>
            </div>
            <button
              onClick={copyAiResponse}
              className={cn(
                "w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-colors",
                aiCopied ? "bg-emerald-500 text-white" : "bg-slate-900 text-white active:bg-slate-700"
              )}
            >
              {aiCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {aiCopied ? "Copié !" : "Copier la réponse"}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/commercial" className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200 flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-base font-black text-slate-900 leading-tight">Réputation Google</h1>
          <p className="text-[11px] text-slate-400">Avis clients et demandes automatiques</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 py-5 pb-10">

        {/* ── Entonnoir ───────────────────────────────────────────────────── */}
        <div>
          <SectionTitle label="Entonnoir de demandes" />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              {[
                { label: "Envoyées", value: sent,    color: "text-blue-600"    },
                { label: "Cliquées", value: clicked, color: "text-amber-500"   },
                { label: "Obtenues", value: obtained, color: "text-emerald-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 text-center">
                  <p className={cn("text-2xl font-black", color)}>{value}</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {sent > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-400 rounded-full" style={{ width: "100%" }} />
                  {sent > 0 && <div className="bg-amber-400 rounded-full" style={{ width: `${(clicked / sent) * 100}%` }} />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {sent > 0 ? `${Math.round((obtained / sent) * 100)}% de taux de conversion` : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Lien Google ─────────────────────────────────────────────────── */}
        <div>
          <SectionTitle label="Votre lien Google" />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-snug">
                Copiez votre lien "Écrire un avis" depuis Google Business Profile.
                Il commence par <span className="font-bold">maps.google.com</span> ou <span className="font-bold">g.page</span>.
              </p>
            </div>
            <input
              type="url"
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
              className="w-full h-11 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm px-3 focus:outline-none focus:border-blue-400 placeholder:text-slate-300"
            />
            {reviewUrl && (
              <a href={reviewUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-blue-500 font-semibold">
                <ExternalLink className="w-3 h-3" />Tester le lien
              </a>
            )}
          </div>
        </div>

        {/* ── Déclenchement automatique ────────────────────────────────────── */}
        <div>
          <SectionTitle label="Déclenchement automatique" />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2">
            <p className="text-[11px] text-slate-400 mb-1">Envoyer une demande d'avis automatiquement après :</p>
            {([
              { value: "none",          label: "Jamais (manuel uniquement)" },
              { value: "job_close",     label: "Clôture d'un chantier"      },
              { value: "invoice_paid",  label: "Paiement d'une facture"     },
              { value: "both",          label: "Les deux"                   },
            ] as const).map(({ value, label }) => (
              <button key={value} onClick={() => setTrigger(value)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-sm font-semibold",
                  trigger === value
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-slate-100 text-slate-600 active:bg-slate-50"
                )}>
                <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  trigger === value ? "border-blue-500 bg-blue-500" : "border-slate-300"
                )}>
                  {trigger === value && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                {label}
              </button>
            ))}
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="mt-1 w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-60 transition-colors"
            >
              {savingConfig ? "Sauvegarde…" : "Enregistrer la configuration"}
            </button>
          </div>
        </div>

        {/* ── Envoyer une demande ──────────────────────────────────────────── */}
        <div>
          <SectionTitle label="Envoyer une demande maintenant" />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
            {!reviewUrl && (
              <div className="flex items-center gap-2 bg-amber-50 rounded-xl p-3">
                <Star className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-[11px] text-amber-700">Configurez votre lien Google ci-dessus avant d'envoyer.</p>
              </div>
            )}
            <select
              value={selectedClient}
              onChange={(e) => setClient(e.target.value)}
              className="w-full h-11 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm px-3 focus:outline-none focus:border-blue-400 text-slate-700"
              disabled={!reviewUrl}
            >
              <option value="">Choisir un client…</option>
              {clients.filter((c) => c.phone).map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
            <button
              onClick={sendRequest}
              disabled={!selectedClient || !reviewUrl || sending}
              className="w-full h-11 bg-[#25D366] text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              {sending ? "Envoi…" : "Envoyer via WhatsApp"}
            </button>
          </div>
        </div>

        {/* ── Historique des demandes ──────────────────────────────────────── */}
        {requests.length > 0 && (
          <div>
            <SectionTitle label="Historique des demandes" />
            <div className="flex flex-col gap-1.5">
              {requests.slice(0, 10).map((req) => (
                <div key={req.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
                    req.obtained_at ? "bg-emerald-500"
                    : req.clicked_at ? "bg-amber-400"
                    : "bg-blue-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{req.client?.full_name ?? "Client"}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(req.sent_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      {req.obtained_at ? " · Avis obtenu ✓" : req.clicked_at ? " · Cliqué" : " · Envoyé"}
                    </p>
                  </div>
                  {!req.obtained_at && (
                    <button
                      onClick={() => req.clicked_at ? markObtained(req.id) : markClicked(req.id)}
                      className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg active:bg-blue-100"
                    >
                      {req.clicked_at ? "Marqué obtenu" : "Marquer cliqué"}
                    </button>
                  )}
                  {req.obtained_at && (
                    <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Générer une réponse IA ───────────────────────────────────────── */}
        <div>
          <SectionTitle label="Générer une réponse à un avis" />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
            <p className="text-[11px] text-slate-400 leading-snug">
              Collez le texte d'un avis Google reçu pour générer une réponse professionnelle adaptée.
            </p>
            <textarea
              value={aiReviewText}
              onChange={(e) => setAiReviewText(e.target.value)}
              placeholder="Ex: Super travail, très professionnel et rapide. Je recommande !"
              rows={3}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-blue-400 resize-none"
            />
            <button
              onClick={() => { generateAiResponse(); setShowAiModal(true); }}
              disabled={!aiReviewText.trim()}
              className="w-full h-11 btn-gradient flex items-center justify-center gap-2 text-sm font-bold rounded-xl disabled:opacity-40"
            >
              <MessageSquare className="w-4 h-4" />
              Générer une réponse
            </button>
          </div>
        </div>

        {/* ── Note honnête ─────────────────────────────────────────────────── */}
        <div className="bg-slate-100 rounded-2xl p-4">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-bold">Note :</span> La note globale et les commentaires Google sont affichés ici après connexion à l'API Google Business Profile. Cette connexion sera disponible dans une prochaine version.
          </p>
        </div>

      </div>
    </div>
  );
}
