"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft, FileText, Mail, Check, Info, Clock, Zap,
  ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { Business, BusinessIntegration, BillingMode, AccountingProvider } from "@/lib/types";

// ─── Tool definitions ─────────────────────────────────────────────────────────
// Each entry defines what the UI shows and what pre-config to collect.
// No real connector exists yet — status will be 'pending' until one is built.

type ConfigField = { key: string; label: string; placeholder: string; type?: string };

type ToolDef = {
  provider: AccountingProvider | null;   // null = "later" (no record saved)
  name: string;
  description: string;
  iconBg: string;
  iconColor: string;
  initial: string;
  configFields: ConfigField[];
};

const TOOLS: ToolDef[] = [
  {
    provider: "odoo",
    name: "Odoo",
    description: "ERP & comptabilité",
    iconBg: "bg-purple-100", iconColor: "text-purple-700", initial: "O",
    configFields: [
      { key: "instance_url", label: "URL de votre instance Odoo", placeholder: "https://mon-entreprise.odoo.com" },
    ],
  },
  {
    provider: "exact",
    name: "Exact Online",
    description: "Comptabilité cloud",
    iconBg: "bg-blue-100", iconColor: "text-blue-700", initial: "E",
    configFields: [
      { key: "company_code", label: "Code société Exact", placeholder: "12345678" },
    ],
  },
  {
    provider: "yuki",
    name: "Yuki",
    description: "Comptabilité en ligne",
    iconBg: "bg-green-100", iconColor: "text-green-700", initial: "Y",
    configFields: [
      { key: "administration_code", label: "Code administration Yuki", placeholder: "YUKI-XXXXX" },
    ],
  },
  {
    provider: "accountable",
    name: "Accountable",
    description: "Pour indépendants",
    iconBg: "bg-teal-100", iconColor: "text-teal-700", initial: "A",
    configFields: [
      { key: "email", label: "Email de votre compte Accountable", placeholder: "prenom@exemple.be", type: "email" },
    ],
  },
  {
    provider: "billit",
    name: "Billit",
    description: "E-facturation BE",
    iconBg: "bg-orange-100", iconColor: "text-orange-700", initial: "B",
    configFields: [
      { key: "gln", label: "Numéro GLN Billit", placeholder: "0208636123456" },
    ],
  },
  {
    provider: "other",
    name: "Autre outil",
    description: "Winbooks, BOB, Sage…",
    iconBg: "bg-slate-100", iconColor: "text-slate-600", initial: "?",
    configFields: [
      { key: "display_name", label: "Nom de l'outil", placeholder: "Ex. : Winbooks, BOB 50, Sage…" },
      { key: "contact",      label: "URL ou email de contact", placeholder: "https://… ou comptable@…" },
    ],
  },
  {
    provider: null,
    name: "Plus tard",
    description: "Configurer plus tard",
    iconBg: "bg-slate-50", iconColor: "text-slate-400", initial: "–",
    configFields: [],
  },
];

// ─── Billing mode options ─────────────────────────────────────────────────────

type BillingOption = {
  value: BillingMode;
  label: string;
  description: string;
  icon: React.ElementType;
};

const BILLING_OPTIONS: BillingOption[] = [
  {
    value: "pdf",
    label: "PDF / Email",
    description: "Envoi de factures PDF par email",
    icon: FileText,
  },
  {
    value: "peppol",
    label: "Peppol",
    description: "E-facturation électronique belge",
    icon: Zap,
  },
  {
    value: "both",
    label: "Les deux",
    description: "PDF email + transmission Peppol",
    icon: FileText,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ComptabiliteFormProps {
  business: Business | null;
  integration: BusinessIntegration | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ComptabiliteForm({ business, integration }: ComptabiliteFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  // ── Section 1: Billing mode + Peppol ──
  const [billingMode, setBillingMode] = useState<BillingMode>(
    business?.billing_mode ?? "pdf"
  );
  const [peppolAddress, setPeppolAddress] = useState(business?.peppol_address ?? "");
  const showPeppol = billingMode === "peppol" || billingMode === "both";

  // ── Section 2: Accounting email ──
  const [accountingEmail, setAccountingEmail] = useState(business?.accounting_email ?? "");

  // ── Section 3: Accounting tool ──
  // Initialize from business.accounting_provider, or null ("later")
  const [selectedProvider, setSelectedProvider] = useState<AccountingProvider | null>(
    business?.accounting_provider ?? null
  );
  // Pre-config per provider (starts from existing integration config)
  const [providerConfig, setProviderConfig] = useState<Record<string, string>>(
    integration?.config ?? {}
  );

  const selectedTool = TOOLS.find((t) => t.provider === selectedProvider);

  const updateConfig = (key: string, value: string) => {
    setProviderConfig((prev) => ({ ...prev, [key]: value }));
  };

  // ── Save ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setSaving(true);
    try {
      // 1. Update businesses table
      const { error: bizErr } = await supabase
        .from("businesses")
        .update({
          billing_mode:         billingMode,
          accounting_email:     accountingEmail.trim() || null,
          peppol_address:       showPeppol ? (peppolAddress.trim() || null) : null,
          peppol_enabled:       false, // stays false until real Peppol connector is built
          accounting_provider:  selectedProvider,
        })
        .eq("id", business.id);
      if (bizErr) throw bizErr;

      // 2. If a real provider is selected, upsert the integration record.
      //    status stays 'pending' — only an actual connector can set it to 'active'.
      if (selectedProvider) {
        const configToSave: Record<string, string> = { ...providerConfig };
        const { error: intErr } = await supabase
          .from("business_integrations")
          .upsert(
            {
              business_id:  business.id,
              provider:     selectedProvider,
              status:       integration?.status === "active" ? "active" : "pending",
              config:       configToSave,
              display_name: selectedProvider === "other"
                ? (configToSave.display_name ?? null)
                : null,
              updated_at:   new Date().toISOString(),
            },
            { onConflict: "business_id,provider" }
          );
        if (intErr) throw intErr;
      }

      toast.success("Configuration enregistrée");
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900">Comptabilité & Facturation</h1>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Configuration entreprise</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 flex flex-col gap-5">

          {/* ── Section 1: Mode de facturation ─────────────────────────── */}
          <Section title="Mode de facturation" subtitle="Comment vos factures sont transmises">

            <div className="flex flex-col gap-2">
              {BILLING_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = billingMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBillingMode(opt.value)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
                      active
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white active:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                      active ? "bg-blue-100" : "bg-slate-100"
                    )}>
                      <Icon className={cn("w-4 h-4", active ? "text-blue-600" : "text-slate-400")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-bold", active ? "text-blue-700" : "text-slate-800")}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center",
                      active ? "border-blue-500 bg-blue-500" : "border-slate-300"
                    )}>
                      {active && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Peppol config — only shown when selected */}
            {showPeppol && (
              <div className="mt-1 flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
                    Adresse Peppol (identifiant réseau)
                  </label>
                  <input
                    type="text"
                    value={peppolAddress}
                    onChange={(e) => setPeppolAddress(e.target.value)}
                    placeholder="0208:0636123456  (préfixe BE + numéro BCE)"
                    className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Format belge : 0208 + numéro BCE sans séparateurs
                  </p>
                </div>

                {/* Honest notice — no fake "active" state */}
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-800">Peppol — configuration enregistrée</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      Vos paramètres sont sauvegardés et seront utilisés lors de la mise en service.
                      La transmission électronique via le réseau Peppol sera activée dans une prochaine version.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* ── Section 2: Email comptable ──────────────────────────────── */}
          <Section title="Email comptable" subtitle="Optionnel — copie automatique sur chaque facture">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
                Email de votre comptable
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={accountingEmail}
                  onChange={(e) => setAccountingEmail(e.target.value)}
                  placeholder="comptable@cabinet.be"
                  className="w-full h-11 pl-10 pr-4 bg-white border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                {accountingEmail.trim()
                  ? `"${accountingEmail}" recevra une copie de chaque facture envoyée.`
                  : "Si renseigné, votre comptable reçoit une copie automatique de chaque facture."}
              </p>
            </div>
          </Section>

          {/* ── Section 3: Outil comptable ──────────────────────────────── */}
          <Section
            title="Outil comptable"
            subtitle="Sélectionnez votre logiciel — connexion préparée pour l'avenir"
          >
            <div className="grid grid-cols-2 gap-2">
              {TOOLS.map((tool) => {
                const active = selectedProvider === tool.provider;
                const isLater = tool.provider === null;
                return (
                  <button
                    key={tool.provider ?? "later"}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(tool.provider);
                      // Reset config when switching tools
                      if (tool.provider !== selectedProvider) setProviderConfig({});
                    }}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all",
                      active && !isLater
                        ? "border-blue-500 bg-blue-50"
                        : active && isLater
                        ? "border-slate-300 bg-slate-50"
                        : "border-slate-200 bg-white active:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2 w-full mb-1.5">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black",
                        tool.iconBg, tool.iconColor
                      )}>
                        {tool.initial}
                      </div>
                      {active && !isLater && (
                        <div className="ml-auto w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs font-bold leading-tight",
                      active && !isLater ? "text-blue-700" : "text-slate-800"
                    )}>
                      {tool.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{tool.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Config panel for selected tool */}
            {selectedTool && selectedProvider !== null && selectedTool.configFields.length > 0 && (
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black",
                    selectedTool.iconBg, selectedTool.iconColor
                  )}>
                    {selectedTool.initial}
                  </div>
                  <p className="text-sm font-bold text-slate-800">{selectedTool.name}</p>
                  <StatusChip status={integration?.status ?? "pending"} />
                </div>

                {selectedTool.configFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                      {field.label}
                      <span className="text-slate-300 font-normal ml-1 normal-case">(optionnel)</span>
                    </label>
                    <input
                      type={field.type ?? "text"}
                      value={providerConfig[field.key] ?? ""}
                      onChange={(e) => updateConfig(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full h-10 bg-white border-2 border-slate-200 rounded-xl px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                ))}

                {/* Honest notice */}
                <div className="flex items-start gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Ces informations sont enregistrées et serviront lors de la mise en place de la
                    connexion avec {selectedTool.name}. Aucune donnée n&apos;est encore transmise.
                  </p>
                </div>
              </div>
            )}

            {/* "Later" selected — neutral info */}
            {selectedProvider === null && (
              <div className="flex items-start gap-2 mt-2 bg-slate-50 rounded-xl border border-slate-200 px-3.5 py-3">
                <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Vous pourrez sélectionner votre outil comptable à tout moment depuis cette page.
                </p>
              </div>
            )}
          </Section>

          {/* ── Save ─────────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={saving || !business}
            className="flex items-center justify-center gap-2 w-full h-13 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl text-base transition-colors disabled:opacity-60"
            style={{ height: "52px" }}
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            {saving ? "Enregistrement…" : "Enregistrer la configuration"}
          </button>

          <div className="h-6" />
        </div>
      </form>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, subtitle, children, collapsible = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        className={cn(
          "w-full flex items-center justify-between px-4 pt-4 pb-3",
          collapsible && "cursor-pointer"
        )}
      >
        <div>
          <h2 className="text-sm font-bold text-slate-800 text-left">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 text-left">{subtitle}</p>}
        </div>
        {collapsible && (
          open
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>}
    </section>
  );
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: "Préparé",  cls: "bg-amber-100 text-amber-700"  },
    configured: { label: "Configuré", cls: "bg-blue-100 text-blue-700"  },
    active:     { label: "Connecté", cls: "bg-emerald-100 text-emerald-700" },
    error:      { label: "Erreur",   cls: "bg-red-100 text-red-600"     },
  };
  const chip = map[status] ?? map.pending;
  return (
    <span className={cn("ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full", chip.cls)}>
      {chip.label}
    </span>
  );
}
