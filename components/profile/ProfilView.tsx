"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Building2, ChevronRight, LogOut,
  FileText, CreditCard, HelpCircle, Bell, BookOpen,
  Shield, Lock, Download, Send, Phone, Loader2,
  CheckCircle2, Mail, ToggleLeft, ToggleRight,
} from "lucide-react";
import type { Business, Profile } from "@/lib/types";
import toast from "react-hot-toast";

interface ProfilViewProps {
  business: Business | null;
  profile: Profile | null;
  email: string;
}

// ─── Month options (last 13 months including current) ─────────────────────────
function buildMonthOptions() {
  const opts: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    opts.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value });
  }
  return opts;
}

// ─── Notification settings key ────────────────────────────────────────────────
const NOTIF_KEY = "altos_notif_settings";

function loadNotifSettings() {
  if (typeof window === "undefined") return { relances: true, rappels: true, important: true };
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : { relances: true, rappels: true, important: true };
  } catch {
    return { relances: true, rappels: true, important: true };
  }
}

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="flex-shrink-0"
      aria-pressed={enabled}
    >
      {enabled
        ? <ToggleRight className="w-7 h-7 text-blue-600" />
        : <ToggleLeft className="w-7 h-7 text-slate-300" />}
    </button>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

function SectionRow({
  icon, iconBg = "bg-slate-100", iconColor = "text-slate-600",
  label, sublabel, href, onClick, right, border = true,
}: {
  icon: React.ElementType;
  iconBg?: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  href?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  border?: boolean;
}) {
  const Icon = icon;
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-base font-medium text-slate-800">{label}</span>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
      {right ?? <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
    </>
  );

  const cls = `flex items-center gap-3 px-4 py-4 active:bg-slate-50 w-full ${border ? "border-b border-slate-50" : ""}`;

  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProfilView({ business, profile, email }: ProfilViewProps) {
  const router = useRouter();
  const supabase = createClient();

  // ── Notification settings ──
  const [notif, setNotif] = useState({ relances: true, rappels: true, important: true });
  useEffect(() => { setNotif(loadNotifSettings()); }, []);
  const updateNotif = (key: keyof typeof notif, v: boolean) => {
    const next = { ...notif, [key]: v };
    setNotif(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  };

  // ── Billing export ──
  const MONTHS = buildMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [exporting, setExporting] = useState(false);
  const [accountantEmail, setAccountantEmail] = useState("");
  const [showAccountantEmail, setShowAccountantEmail] = useState(false);

  // ── Security ──
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handlePasswordReset = async () => {
    if (resetSent) return;
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Email de réinitialisation envoyé !");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : null) || "Impossible d'envoyer l'email");
    } finally {
      setResetLoading(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const start = new Date(year, month - 1, 1).toISOString();
      const end   = new Date(year, month, 1).toISOString();

      // Fetch invoices for the selected month
      const { data: estimates, error } = await supabase
        .from("estimates")
        .select(`
          id, number, title, status, total_amount_ht, vat_rate, discount, discount_type,
          notes, client_notes, payment_terms, validity_days, share_token,
          viewed_at, viewed_count, signed_at, signature_svg, signed_by_name, signed_by_ip,
          stripe_payment_intent_id, stripe_payment_link, paid_at,
          issued_at, expires_at, created_at, updated_at,
          client_id, business_id, version,
          client:clients(id, business_id, full_name, company_name, phone, email, address, city, postal_code, notes, tags, created_at, updated_at)
        `)
        .eq("business_id", business?.id || "")
        .in("status", ["accepted", "invoiced", "paid"])
        .gte("issued_at", start)
        .lt("issued_at", end);

      if (error) throw error;
      if (!estimates || estimates.length === 0) {
        toast.error("Aucune facture trouvée pour ce mois");
        return;
      }

      // Fetch items for each estimate
      const ids = estimates.map((e: { id: string }) => e.id);
      const { data: items } = await supabase
        .from("estimate_items")
        .select("*")
        .in("estimate_id", ids);

      const itemsByEstimate: Record<string, unknown[]> = {};
      for (const item of items || []) {
        const ei = item as { estimate_id: string };
        if (!itemsByEstimate[ei.estimate_id]) itemsByEstimate[ei.estimate_id] = [];
        itemsByEstimate[ei.estimate_id].push(item);
      }

      // Dynamic import to keep initial bundle small
      const [{ generateEstimatePdfBlob }, JSZip] = await Promise.all([
        import("@/lib/generateEstimatePdf"),
        import("jszip").then((m) => m.default),
      ]);

      const zip = new JSZip();
      const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || selectedMonth;

      for (const estimate of estimates) {
        const withItems = {
          ...estimate,
          items: (itemsByEstimate[estimate.id] || []) as import("@/lib/types").EstimateItem[],
          client: Array.isArray(estimate.client) ? estimate.client[0] : estimate.client,
        } as import("@/lib/types").Estimate & { items: import("@/lib/types").EstimateItem[] };

        const clientData = Array.isArray(estimate.client) ? estimate.client[0] : estimate.client;

        const { blob, filename } = await generateEstimatePdfBlob(
          withItems,
          business,
          clientData as import("@/lib/types").Client | null
        );
        zip.file(filename, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factures-${monthLabel.replace(/\s/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${estimates.length} facture${estimates.length > 1 ? "s" : ""} exportée${estimates.length > 1 ? "s" : ""}`);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const handleSendAccountant = () => {
    if (!accountantEmail.trim()) {
      setShowAccountantEmail(true);
      return;
    }
    const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || selectedMonth;
    const subject = encodeURIComponent(`Factures ${monthLabel} — ${business?.name || "Mon entreprise"}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver ci-joint les factures du mois de ${monthLabel}.\n\nCordialement,\n${business?.name || ""}`
    );
    window.location.href = `mailto:${accountantEmail}?subject=${subject}&body=${body}`;
  };

  const phone = business?.phone;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-black text-slate-900">Profil</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4">

        {/* ── Avatar + infos ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-2xl font-black">
              {(business?.name || profile?.full_name || email)[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-slate-900 truncate">
              {business?.name || profile?.full_name || "Mon Entreprise"}
            </p>
            {business?.activity && (
              <p className="text-sm text-blue-600 font-semibold">{business.activity}</p>
            )}
            {phone && (
              <p className="text-sm text-slate-500 truncate">{phone}</p>
            )}
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>
        </div>

        {!business && (
          <Link
            href="/profil/entreprise"
            className="flex items-center gap-3 bg-blue-600 rounded-2xl p-4 text-white"
          >
            <Building2 className="w-5 h-5" />
            <div>
              <p className="font-bold">Configurer mon entreprise</p>
              <p className="text-xs text-blue-200">Nom, SIRET, logo…</p>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto" />
          </Link>
        )}

        {/* ── Mon Entreprise ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mon Entreprise</h2>
          <SectionCard>
            <SectionRow icon={Building2} label="Infos & Logo" href="/profil/entreprise" />
            <SectionRow icon={CreditCard} label="Paiement & IBAN" href="/profil/entreprise" border={false} />
          </SectionCard>
        </section>

        {/* ── Facturation ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Facturation</h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">

            {/* Month selector */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Période
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full h-11 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={exporting || !business}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl h-12 transition-colors disabled:opacity-60"
            >
              {exporting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              {exporting ? "Export en cours…" : "Exporter les factures (ZIP)"}
            </button>

            {/* Send to accountant */}
            {showAccountantEmail ? (
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  value={accountantEmail}
                  onChange={(e) => setAccountantEmail(e.target.value)}
                  placeholder="comptable@exemple.fr"
                  autoFocus
                  className="w-full h-11 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={handleSendAccountant}
                  disabled={!accountantEmail.trim()}
                  className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl h-11 transition-colors disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  Envoyer par email
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAccountantEmail(true)}
                disabled={!business}
                className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-200 text-slate-700 font-semibold rounded-xl h-11 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Envoyer au comptable
              </button>
            )}

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Exporte toutes les factures acceptées / payées du mois sélectionné.
            </p>
          </div>
        </section>

        {/* ── Outils ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Outils</h2>
          <SectionCard>
            <SectionRow icon={BookOpen} label="Mes prestations" href="/catalogue" border={false} />
          </SectionCard>
        </section>

        {/* ── Application ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Application</h2>
          <SectionCard>
            <SectionRow icon={HelpCircle} label="Aide & Support" href="/profil/aide" />
            <SectionRow icon={FileText} label="CGU & Confidentialité" href="/profil/cgu" border={false} />
          </SectionCard>
        </section>

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notifications</h2>
          <SectionCard>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-50">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">Relances automatiques</p>
                <p className="text-xs text-slate-400">Devis sans réponse après 48h</p>
              </div>
              <Toggle enabled={notif.relances} onChange={(v) => updateNotif("relances", v)} />
            </div>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-50">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">Rappels d'intervention</p>
                <p className="text-xs text-slate-400">La veille des interventions planifiées</p>
              </div>
              <Toggle enabled={notif.rappels} onChange={(v) => updateNotif("rappels", v)} />
            </div>
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">Notifications importantes</p>
                <p className="text-xs text-slate-400">Devis acceptés, paiements reçus</p>
              </div>
              <Toggle enabled={notif.important} onChange={(v) => updateNotif("important", v)} />
            </div>
          </SectionCard>
        </section>

        {/* ── Sécurité ────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sécurité</h2>
          <SectionCard>
            {/* Change password */}
            <button
              onClick={handlePasswordReset}
              disabled={resetLoading || resetSent}
              className="flex items-center gap-3 px-4 py-4 active:bg-slate-50 w-full border-b border-slate-50 disabled:opacity-60"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                {resetSent
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : resetLoading
                    ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    : <Lock className="w-4 h-4 text-slate-600" />
                }
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-base font-medium text-slate-800">Changer le mot de passe</p>
                {resetSent && (
                  <p className="text-xs text-emerald-600 mt-0.5">Email envoyé à {email}</p>
                )}
              </div>
              {!resetSent && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
            </button>

            {/* Sign-in methods */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-50">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">Méthodes de connexion</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                    <Mail className="w-2.5 h-2.5" />
                    Email
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
                    <Phone className="w-2.5 h-2.5" />
                    Google
                  </span>
                </div>
              </div>
            </div>

            {/* Forgot password link */}
            <Link
              href="/reset-password"
              className="flex items-center gap-3 px-4 py-4 active:bg-slate-50"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-4 h-4 text-slate-600" />
              </div>
              <span className="flex-1 text-base font-medium text-slate-800">Mot de passe oublié</span>
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            </Link>
          </SectionCard>
        </section>

        {/* ── Déconnexion ─────────────────────────────────────────────────── */}
        <button
          onClick={logout}
          className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4 text-red-600 w-full"
        >
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-base font-semibold">Se déconnecter</span>
        </button>

        <p className="text-center text-xs text-slate-300 pb-4">Altos v1.0.0 · Artisan Pro</p>
      </div>
    </div>
  );
}
