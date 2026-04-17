"use client";

import { useState } from "react";
import { X, MessageSquare, Edit3, Send, ChevronRight } from "lucide-react";

export interface MessageSheetProps {
  /** E.164 or local phone number, e.g. "+32470123456" or "0470123456" */
  phone: string;
  /** Used to personalise template messages */
  clientName: string;
  /** Optional extra context (estimate title, job title…) */
  context?: string;
  onClose: () => void;
}

// Returns first name from full name
function firstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

// Format current time as HH:MM
function nowTime(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}

function normalisePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-\.\(\)\/]/g, "");
  if (cleaned.startsWith("+")) return cleaned.replace("+", "");
  if (cleaned.startsWith("0032")) return cleaned.slice(2);
  if (cleaned.startsWith("0")) return "32" + cleaned.slice(1);
  return cleaned;
}

function waHref(phone: string, text: string): string {
  return `https://wa.me/${normalisePhone(phone)}?text=${encodeURIComponent(text)}`;
}

function smsHref(phone: string, text: string): string {
  return `sms:${phone}?body=${encodeURIComponent(text)}`;
}

type View = "menu" | "templates" | "custom";

export default function MessageSheet({ phone, clientName, context, onClose }: MessageSheetProps) {
  const [view, setView] = useState<View>("menu");
  const [customText, setCustomText] = useState("");

  const nom = firstName(clientName);
  const heure = nowTime();

  const TEMPLATES = [
    {
      label: "Je suis en route",
      text: `Bonjour ${nom}, je suis en route et j'arrive bientôt.`,
    },
    {
      label: `Dans 20 minutes`,
      text: `Bonjour ${nom}, je serai là dans environ 20 minutes.`,
    },
    {
      label: "Confirmation de rendez-vous",
      text: `Bonjour ${nom}, pouvez-vous confirmer notre rendez-vous prévu aujourd'hui ?`,
    },
    ...(context
      ? [{
          label: "Voici votre devis",
          text: `Bonjour ${nom}, je vous fais parvenir ${context}. N'hésitez pas si vous avez des questions.`,
        }]
      : []),
    {
      label: "Merci pour votre confiance",
      text: `Bonjour ${nom}, merci pour votre confiance. C'est un plaisir de travailler avec vous !`,
    },
    {
      label: "Passage prévu à " + heure,
      text: `Bonjour ${nom}, je compte passer vers ${heure}. Est-ce que cela vous convient ?`,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {view !== "menu" && (
              <button
                onClick={() => setView("menu")}
                className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mr-1"
              >
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 rotate-180" />
              </button>
            )}
            <p className="text-sm font-black text-slate-900">
              {view === "menu" && "Message à " + firstName(clientName)}
              {view === "templates" && "Messages rapides"}
              {view === "custom" && "Message personnalisé"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* ── Menu principal ── */}
          {view === "menu" && (
            <div className="px-4 py-3 flex flex-col gap-2">
              <button
                onClick={() => setView("templates")}
                className="flex items-center gap-3.5 px-4 py-4 rounded-2xl bg-emerald-50 active:bg-emerald-100 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">Message rapide</p>
                  <p className="text-xs text-slate-500 mt-0.5">Choisir un modèle pré-rédigé</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>

              <button
                onClick={() => setView("custom")}
                className="flex items-center gap-3.5 px-4 py-4 rounded-2xl bg-slate-50 active:bg-slate-100 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">Message personnalisé</p>
                  <p className="text-xs text-slate-500 mt-0.5">Rédiger votre propre message</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>

              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 active:bg-slate-200 mt-1"
              >
                <X className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-500">Annuler</span>
              </button>
            </div>
          )}

          {/* ── Templates ── */}
          {view === "templates" && (
            <div className="px-4 py-3 flex flex-col gap-2">
              <p className="text-xs text-slate-400 px-1 mb-1">
                Le message s'ouvrira dans WhatsApp pour relecture avant envoi.
              </p>
              {TEMPLATES.map((tpl) => (
                <a
                  key={tpl.label}
                  href={waHref(phone, tpl.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100 border border-slate-100"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{tpl.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{tpl.text}</p>
                  </div>
                </a>
              ))}

              {/* SMS fallback */}
              <p className="text-xs text-slate-400 text-center mt-1 mb-0.5">Pas WhatsApp ?</p>
              <a
                href={smsHref(phone, `Bonjour ${nom}, `)}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 bg-white active:bg-slate-50"
                onClick={onClose}
              >
                <Send className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">Envoyer par SMS</span>
              </a>
            </div>
          )}

          {/* ── Custom message ── */}
          {view === "custom" && (
            <div className="px-4 py-3 flex flex-col gap-3">
              <p className="text-xs text-slate-400 px-1">
                Le message s'ouvrira dans WhatsApp pour relecture avant envoi.
              </p>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={`Bonjour ${nom}, …`}
                autoFocus
                rows={5}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none transition-colors"
              />

              <a
                href={waHref(phone, customText || `Bonjour ${nom}, `)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-2xl py-4 active:opacity-80 transition-opacity"
              >
                <MessageSquare className="w-5 h-5" />
                Ouvrir dans WhatsApp
              </a>

              <a
                href={smsHref(phone, customText || `Bonjour ${nom}, `)}
                onClick={onClose}
                className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-semibold rounded-2xl py-3.5 active:bg-slate-200"
              >
                <Send className="w-4 h-4" />
                Envoyer par SMS
              </a>
            </div>
          )}
        </div>

        <div className="pb-safe h-3 flex-shrink-0" />
      </div>
    </>
  );
}
