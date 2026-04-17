"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import {
  ArrowLeft, ArrowRight, Check, User,
  Banknote, CreditCard, MessageCircle, Zap,
  Plus, Trash2, Search, X, PenLine,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Business, Client } from "@/lib/types";
import { getSuggestionsForActivity } from "@/lib/trade-suggestions";
import { cn } from "@/lib/utils";

interface QuickInterventionProps {
  business: Business | null;
  clients: Client[];
}

interface ServiceLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

const STEPS = ["Client", "Prestations", "Validation", "Signature"];

const newLine = (): ServiceLine => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit: "forfait",
  unit_price: 0,
});

export default function QuickIntervention({ business, clients }: QuickInterventionProps) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0 – Client
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [newClient, setNewClient] = useState({ full_name: "", phone: "", address: "", email: "" });
  const [isNewClient, setIsNewClient] = useState(false);

  // Step 1 – Prestations
  const [lines, setLines] = useState<ServiceLine[]>([newLine()]);

  // Step 2 – Validation & Paiement
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "link" | null>(null);
  const [notes, setNotes] = useState("");

  // Step 3 – Signature (optionnelle)
  const [withSignature, setWithSignature] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [drawing, setDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };
  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    e.preventDefault(); setDrawing(true); lastPosRef.current = getPos(e, canvas);
  };
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing || !canvasRef.current) return; e.preventDefault();
    const canvas = canvasRef.current; const ctx = canvas.getContext("2d");
    if (!ctx || !lastPosRef.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5;
    ctx.lineCap = "round"; ctx.stroke(); lastPosRef.current = pos;
  };
  const endDraw = () => { setDrawing(false); lastPosRef.current = null; };
  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const vatRate = business?.vat_regime === "none" || business?.vat_regime === "micro" ? 0 : 20;
  const totalTTC = totalHT * (1 + vatRate / 100);

  const suggestions = getSuggestionsForActivity(business?.activity);

  const filteredClients = clients.filter((c) =>
    c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone?.includes(clientSearch)
  );

  // ─── Validation finale ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!business?.id) { toast.error("Configurez d'abord votre entreprise"); return; }
    if (!paymentMethod) { toast.error("Choisissez un mode de paiement"); return; }

    // Si signature demandée mais pas encore validée → aller à l'étape signature
    if (withSignature && step === 2) { setStep(3); return; }

    setLoading(true);
    try {
      let clientId: string | null = null;

      if (isNewClient) {
        if (!newClient.full_name || !newClient.phone) {
          toast.error("Nom et téléphone obligatoires"); setLoading(false); return;
        }
        const { data: c, error } = await supabase
          .from("clients")
          .insert({ ...newClient, business_id: business.id })
          .select().single();
        if (error) throw error;
        clientId = c.id;
      } else {
        clientId = selectedClient?.id || null;
      }

      const firstService = lines[0]?.description || "Intervention";

      const { data: numData } = await supabase.rpc("generate_estimate_number", { p_business_id: business.id });

      const status = paymentMethod === "cash" || paymentMethod === "card" ? "paid" : "accepted";

      // Préparer la signature si disponible
      let signatureData: Record<string, unknown> = {};
      if (withSignature && signerName.trim() && canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        const imageData = ctx?.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        const hasSignature = imageData?.data.some((v, i) => i % 4 === 3 && v > 0);
        if (hasSignature) {
          signatureData = {
            signed_at: new Date().toISOString(),
            signed_by_name: signerName.trim(),
            signature_svg: canvasRef.current.toDataURL("image/png"),
          };
        }
      }

      const { data: estimate, error: estError } = await supabase
        .from("estimates")
        .insert({
          business_id: business.id,
          client_id: clientId,
          number: numData,
          status,
          title: firstService,
          vat_rate: vatRate,
          notes,
          issued_at: new Date().toISOString(),
          paid_at: status === "paid" ? new Date().toISOString() : null,
          ...signatureData,
        })
        .select().single();
      if (estError) throw estError;

      await supabase.from("estimate_items").insert(
        lines.map((l, i) => ({
          estimate_id: estimate.id,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          sort_order: i,
          is_section: false,
        }))
      );

      await supabase.from("jobs").insert({
        business_id: business.id,
        client_id: clientId,
        estimate_id: estimate.id,
        title: firstService,
        status: status === "paid" ? "completed" : "in_progress",
        completed_date: status === "paid" ? new Date().toISOString() : null,
        notes,
      });

      toast.success("Intervention enregistrée !");

      if (paymentMethod === "link") {
        router.push(`/devis/${estimate.id}/envoyer`);
      } else {
        router.push(`/devis/${estimate.id}/edit`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  // ─── Rendu par étape ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => step === 0 ? router.back() : setStep(step - 1)}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-500" />
              <h1 className="text-base font-black text-slate-900">Intervention rapide</h1>
            </div>
            {/* Stepper */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                    i < step ? "bg-emerald-500 text-white" :
                    i === step ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
                  )}>
                    {i < step ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={cn("text-[10px] font-semibold", i === step ? "text-blue-600" : "text-slate-400")}>
                    {s}
                  </span>
                  {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {/* ── ÉTAPE 0 : CLIENT ─────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <p className="text-sm text-slate-500">Sélectionnez ou créez un client</p>

            {/* Toggle existant / nouveau */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => { setIsNewClient(false); setSelectedClient(null); }}
                className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
                  !isNewClient ? "bg-white shadow text-slate-900" : "text-slate-400")}
              >
                Existant
              </button>
              <button
                onClick={() => { setIsNewClient(true); setSelectedClient(null); }}
                className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
                  isNewClient ? "bg-white shadow text-slate-900" : "text-slate-400")}
              >
                Nouveau client
              </button>
            </div>

            {!isNewClient ? (
              // Client existant
              selectedClient ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{selectedClient.full_name}</p>
                    {selectedClient.phone && <p className="text-sm text-slate-400">{selectedClient.phone}</p>}
                  </div>
                  <button onClick={() => setSelectedClient(null)}
                    className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      autoFocus
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Rechercher un client…"
                      className="w-full h-12 bg-white border-2 border-slate-200 rounded-xl pl-9 pr-4 text-base focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {filteredClients.slice(0, 6).map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedClient(c)}
                        className={cn("w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50",
                          i < Math.min(filteredClients.length, 6) - 1 && "border-b border-slate-50")}
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-slate-500">{c.full_name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{c.full_name}</p>
                          {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                        </div>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="text-center text-sm text-slate-400 py-6">Aucun client trouvé</p>
                    )}
                  </div>
                </div>
              )
            ) : (
              // Nouveau client
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
                <Input
                  label="Nom complet *"
                  placeholder="Jean Dupont"
                  value={newClient.full_name}
                  onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
                  required
                />
                <Input
                  label="Téléphone *"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  inputMode="tel"
                />
                <Input
                  label="Adresse"
                  placeholder="12 rue de la Paix, Paris"
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                />
                <Input
                  label="Email (optionnel)"
                  type="email"
                  placeholder="jean@example.fr"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                />
              </div>
            )}

            <Button
              size="xl"
              onClick={() => {
                if (!isNewClient && !selectedClient) { toast.error("Sélectionnez un client"); return; }
                if (isNewClient && (!newClient.full_name || !newClient.phone)) {
                  toast.error("Nom et téléphone obligatoires"); return;
                }
                setStep(1);
              }}
              className="w-full mt-2"
            >
              Suivant <ArrowRight className="w-5 h-5" />
            </Button>
          </>
        )}

        {/* ── ÉTAPE 1 : PRESTATIONS ────────────────────────────────────── */}
        {step === 1 && (
          <>
            <p className="text-sm text-slate-500">Ajoutez les prestations réalisées</p>

            {/* Suggestions rapides */}
            {suggestions.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Suggestions rapides
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.slice(0, 6).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setLines((prev) => [...prev, {
                          id: crypto.randomUUID(),
                          description: s.description,
                          quantity: 1,
                          unit: s.unit,
                          unit_price: 0,
                        }]);
                      }}
                      className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 active:scale-95 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-500" />
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lignes */}
            <div className="flex flex-col gap-2">
              {lines.map((line, idx) => (
                <div key={line.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <input
                      value={line.description}
                      onChange={(e) => setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, description: e.target.value } : l))}
                      placeholder={`Prestation ${idx + 1}…`}
                      className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-blue-500"
                    />
                    {lines.length > 1 && (
                      <button
                        onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                        className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium block mb-1">Qté</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, quantity: parseFloat(e.target.value) || 1 } : l))}
                        min="0.5" step="0.5"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-sm font-semibold text-center focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium block mb-1">Unité</label>
                      <select
                        value={line.unit}
                        onChange={(e) => setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, unit: e.target.value } : l))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-sm font-semibold text-center focus:outline-none appearance-none"
                      >
                        {["u","h","m","m²","forfait","jour"].map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium block mb-1">Prix €</label>
                      <input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, unit_price: parseFloat(e.target.value) || 0 } : l))}
                        min="0" step="0.01" inputMode="decimal"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-sm font-semibold text-right focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="text-right mt-2">
                    <span className="text-xs font-black text-slate-600 tabular-nums">
                      = {formatCurrency(line.quantity * line.unit_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setLines((prev) => [...prev, newLine()])}
              className="flex items-center gap-2 text-blue-600 font-semibold text-sm py-2"
            >
              <Plus className="w-4 h-4" /> Ajouter une prestation
            </button>

            {/* Total */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Total HT</span>
                <span className="font-bold tabular-nums">{formatCurrency(totalHT)}</span>
              </div>
              {vatRate > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">TVA {vatRate}%</span>
                  <span className="font-bold tabular-nums">{formatCurrency(totalHT * vatRate / 100)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 mt-1">
                <span className="font-black text-slate-900">Total TTC</span>
                <span className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</span>
              </div>
            </div>

            <Button
              size="xl"
              onClick={() => {
                const hasValid = lines.some((l) => l.description && l.unit_price > 0);
                if (!hasValid) { toast.error("Ajoutez au moins une prestation avec un prix"); return; }
                setStep(2);
              }}
              className="w-full"
            >
              Suivant <ArrowRight className="w-5 h-5" />
            </Button>
          </>
        )}

        {/* ── ÉTAPE 2 : VALIDATION & PAIEMENT ─────────────────────────── */}
        {step === 2 && (
          <>
            <p className="text-sm text-slate-500">Comment a été réglée l'intervention ?</p>

            {/* Récap */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-500">
                    {isNewClient ? newClient.full_name : selectedClient?.full_name}
                  </p>
                  <p className="text-sm text-slate-400">
                    {lines.filter((l) => l.description).length} prestation{lines.length > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</span>
              </div>
            </div>

            {/* Modes de paiement */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Paiement</p>
              <div className="flex flex-col gap-2">
                {[
                  { key: "cash",  icon: Banknote,       label: "Espèces",          sub: "Payé sur place en cash",        color: "border-emerald-300 bg-emerald-50" },
                  { key: "card",  icon: CreditCard,     label: "Carte bancaire",    sub: "Terminal de paiement mobile",   color: "border-blue-300 bg-blue-50" },
                  { key: "link",  icon: MessageCircle,  label: "Lien de paiement",  sub: "Envoyer par WhatsApp / SMS",    color: "border-amber-300 bg-amber-50" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key as any)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl p-4 border-2 text-left transition-all",
                      paymentMethod === m.key ? m.color : "bg-white border-slate-200"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      paymentMethod === m.key ? "bg-white shadow" : "bg-slate-100")}>
                      <m.icon className={cn("w-5 h-5", paymentMethod === m.key ? "text-slate-700" : "text-slate-400")} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{m.label}</p>
                      <p className="text-xs text-slate-400">{m.sub}</p>
                    </div>
                    {paymentMethod === m.key && (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarques sur l'intervention…"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-500"
                rows={2}
              />
            </div>

            {/* Option signature */}
            <button
              onClick={() => setWithSignature(!withSignature)}
              className={cn(
                "flex items-center gap-3 rounded-2xl p-4 border-2 text-left transition-all w-full",
                withSignature ? "border-blue-300 bg-blue-50" : "bg-white border-slate-200"
              )}
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                withSignature ? "bg-blue-100" : "bg-slate-100")}>
                <PenLine className={cn("w-5 h-5", withSignature ? "text-blue-600" : "text-slate-400")} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900">Faire signer le client</p>
                <p className="text-xs text-slate-400">Signature électronique sur écran</p>
              </div>
              {withSignature && (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>

            <Button
              size="xl"
              onClick={handleSubmit}
              loading={loading}
              variant="success"
              className="w-full"
            >
              <Check className="w-5 h-5" />
              {withSignature ? "Continuer vers la signature" : "Valider l'intervention"}
            </Button>
          </>
        )}

        {/* ── ÉTAPE 3 : SIGNATURE ──────────────────────────────────────── */}
        {step === 3 && (
          <>
            <p className="text-sm text-slate-500">Faites signer votre client pour confirmer l'intervention</p>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-slate-900">Signature du client</p>
                <span className="text-xs text-slate-400">Optionnel</span>
              </div>

              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nom complet du signataire"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base mb-3 focus:outline-none focus:border-blue-500"
              />

              <div className="relative border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50 mb-3">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={120}
                  className="w-full touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none select-none">
                  Signez ici avec votre doigt
                </p>
                <button onClick={clearCanvas} className="absolute top-2 right-2 text-xs text-slate-400 font-medium">
                  Effacer
                </button>
              </div>
            </div>

            <Button
              size="xl"
              onClick={handleSubmit}
              loading={loading}
              variant="success"
              className="w-full"
            >
              <Check className="w-5 h-5" />
              Valider l'intervention
            </Button>

            <button
              onClick={handleSubmit}
              className="text-sm text-slate-400 font-medium text-center w-full py-2"
            >
              Passer la signature →
            </button>
          </>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
