import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formate un montant en euros
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Formate une date en français
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

// Calcule le montant TTC
export function calculateTTC(ht: number, vatRate: number): number {
  return ht * (1 + vatRate / 100);
}

// Calcule la TVA
export function calculateVAT(ht: number, vatRate: number): number {
  return ht * (vatRate / 100);
}

// Génère le lien de partage d'un devis
export function getEstimateShareUrl(shareToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/p/${shareToken}`;
}

// Texte de relance WhatsApp pré-rédigé
export function getWhatsAppReminderText(
  clientName: string,
  jobTitle: string,
  shareUrl: string,
  businessName: string
): string {
  return encodeURIComponent(
    `Bonjour ${clientName},\n\nJ'espère que vous allez bien. Avez-vous pu consulter mon devis pour "${jobTitle}" ?\n\nJe reste disponible pour toute question : ${shareUrl}\n\nCordialement,\n${businessName}`
  );
}

// Status badge config
export const ESTIMATE_STATUS_CONFIG = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-600" },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700" },
  viewed: { label: "Consulté", color: "bg-amber-100 text-amber-700" },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-700" },
  declined: { label: "Refusé", color: "bg-red-100 text-red-700" },
  invoiced: { label: "Facturé", color: "bg-purple-100 text-purple-700" },
  paid: { label: "Payé", color: "bg-emerald-100 text-emerald-700" },
  archived: { label: "Archivé", color: "bg-gray-100 text-gray-500" },
} as const;

export const JOB_STATUS_CONFIG = {
  planned: { label: "Planifié", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Terminé", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700" },
} as const;
