"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Send, Save, User, Search, X, ArrowLeft, Tag
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Business, Client, Estimate, EstimateItem, LibraryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EstimateFormProps {
  business: Business | null;
  clients: Client[];
  mode: "create" | "edit";
  estimate?: Estimate;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  is_section: boolean;
  sort_order: number;
}

const UNITS = ["u", "h", "m", "m²", "m³", "forfait", "jour", "semaine"];

const newLine = (sort_order: number): LineItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit: "u",
  unit_price: 0,
  discount: 0,
  is_section: false,
  sort_order,
});

export default function EstimateForm({ business, clients, mode, estimate }: EstimateFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Client sélectionné
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    estimate?.client as Client | null || null
  );
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);

  // Infos devis
  const [title, setTitle] = useState(estimate?.title || "");
  const [vatRate, setVatRate] = useState(estimate?.vat_rate || 20);
  const [clientNotes, setClientNotes] = useState(estimate?.client_notes || "");
  const [validityDays, setValidityDays] = useState(estimate?.validity_days || 30);

  // Lignes
  const [lines, setLines] = useState<LineItem[]>(
    estimate?.items?.map((item) => ({
      ...item,
      id: item.id,
    })) || [newLine(0)]
  );

  // Suggestions autocomplétion
  const [suggestions, setSuggestions] = useState<LibraryItem[]>([]);
  const [activeSuggestionLine, setActiveSuggestionLine] = useState<string | null>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculs
  const totalHT = lines
    .filter((l) => !l.is_section)
    .reduce((sum, l) => sum + l.quantity * l.unit_price * (1 - l.discount / 100), 0);
  const vatAmount = totalHT * (vatRate / 100);
  const totalTTC = totalHT + vatAmount;

  // Autocomplétion depuis le catalogue
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !business?.id) {
      setSuggestions([]);
      return;
    }
    const { data } = await supabase
      .from("library_items")
      .select("*")
      .eq("business_id", business.id)
      .ilike("description", `%${query}%`)
      .order("usage_count", { ascending: false })
      .limit(5);
    setSuggestions(data || []);
  }, [business?.id]);

  const handleLineDescriptionChange = (id: string, value: string) => {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, description: value } : l));
    setActiveSuggestionLine(id);
    if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    suggestionTimerRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const applySuggestion = (lineId: string, item: LibraryItem) => {
    setLines((prev) =>
      prev.map((l) => l.id === lineId
        ? { ...l, description: item.description, unit_price: item.unit_price, unit: item.unit }
        : l
      )
    );
    setSuggestions([]);
    setActiveSuggestionLine(null);
    // Incrémenter usage_count
    supabase.from("library_items").update({ usage_count: item.usage_count + 1 }).eq("id", item.id);
  };

  const addLine = (isSection = false) => {
    setLines((prev) => [
      ...prev,
      { ...newLine(prev.length), is_section: isSection },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof LineItem, value: unknown) => {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const saveToLibrary = async (line: LineItem) => {
    if (!business?.id || !line.description || line.is_section) return;
    const existing = await supabase
      .from("library_items")
      .select("id")
      .eq("business_id", business.id)
      .ilike("description", line.description)
      .single();
    if (!existing.data) {
      await supabase.from("library_items").insert({
        business_id: business.id,
        description: line.description,
        unit: line.unit,
        unit_price: line.unit_price,
      });
    }
  };

  const saveEstimate = async (status: "draft" | "sent" = "draft") => {
    if (!business?.id) {
      toast.error("Configurez d'abord votre entreprise");
      return;
    }

    const isSending = status === "sent";
    if (isSending) setSending(true);
    else setSaving(true);

    try {
      let estimateId = estimate?.id;

      if (mode === "create") {
        // Générer le numéro
        const { data: numData } = await supabase.rpc("generate_estimate_number", {
          p_business_id: business.id,
        });

        const { data: newEstimate, error } = await supabase
          .from("estimates")
          .insert({
            business_id: business.id,
            client_id: selectedClient?.id || null,
            number: numData,
            status,
            title,
            vat_rate: vatRate,
            client_notes: clientNotes,
            validity_days: validityDays,
            issued_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + validityDays * 86400000).toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        estimateId = newEstimate.id;
      } else if (estimateId) {
        const { error } = await supabase
          .from("estimates")
          .update({
            client_id: selectedClient?.id || null,
            status,
            title,
            vat_rate: vatRate,
            client_notes: clientNotes,
            validity_days: validityDays,
          })
          .eq("id", estimateId);
        if (error) throw error;

        // Supprimer les anciennes lignes
        await supabase.from("estimate_items").delete().eq("estimate_id", estimateId);
      }

      // Insérer les lignes
      if (estimateId) {
        const items = lines.map((line, i) => ({
          estimate_id: estimateId,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unit_price,
          discount: line.discount,
          sort_order: i,
          is_section: line.is_section,
        }));

        const { error: itemsError } = await supabase.from("estimate_items").insert(items);
        if (itemsError) throw itemsError;

        // Sauvegarder dans le catalogue
        await Promise.all(lines.map(saveToLibrary));
      }

      if (isSending) {
        toast.success("Devis prêt à envoyer !");
        router.push(`/devis/${estimateId}/envoyer`);
      } else {
        toast.success("Devis sauvegardé");
        if (mode === "create") router.push(`/devis/${estimateId}/edit`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone?.includes(clientSearch)
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-900">
              {mode === "create" ? "Nouveau Devis" : `Modifier ${estimate?.number || ""}`}
            </h1>
          </div>
          <Button size="sm" variant="outline" onClick={() => saveEstimate("draft")} loading={saving}>
            <Save className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => saveEstimate("sent")} loading={sending}>
            <Send className="w-4 h-4" />
            Envoyer
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 flex flex-col gap-4">

          {/* Client */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Client</h2>
            </div>
            {selectedClient ? (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900">{selectedClient.full_name}</p>
                  {selectedClient.company_name && (
                    <p className="text-sm text-slate-500">{selectedClient.company_name}</p>
                  )}
                  {selectedClient.phone && (
                    <p className="text-sm text-slate-400">{selectedClient.phone}</p>
                  )}
                </div>
                <button onClick={() => setSelectedClient(null)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <div className="p-4">
                <button
                  onClick={() => setShowClientPicker(true)}
                  className="w-full flex items-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 text-slate-500 active:scale-98 transition-transform"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Choisir un client</span>
                </button>
                <button
                  onClick={() => router.push("/clients/nouveau?return=devis")}
                  className="w-full mt-2 text-sm text-blue-600 font-semibold py-2 text-center"
                >
                  + Nouveau client
                </button>
              </div>
            )}
          </section>

          {/* Titre chantier */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <Input
              label="Titre du chantier"
              placeholder="Ex: Installation électrique appartement T3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </section>

          {/* Lignes de devis */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Prestations</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => addLine(true)}
                  className="text-xs text-slate-500 font-semibold px-2 py-1 rounded-lg bg-slate-50 border border-slate-200"
                >
                  + Titre
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {lines.map((line, index) => (
                <LineRow
                  key={line.id}
                  line={line}
                  index={index}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  onDescriptionChange={handleLineDescriptionChange}
                  suggestions={activeSuggestionLine === line.id ? suggestions : []}
                  onSuggestionApply={(item) => applySuggestion(line.id, item)}
                  onSuggestionDismiss={() => {
                    setSuggestions([]);
                    setActiveSuggestionLine(null);
                  }}
                  canRemove={lines.length > 1}
                />
              ))}
            </div>

            <div className="px-4 py-3 border-t border-slate-50">
              <button
                onClick={() => addLine(false)}
                className="flex items-center gap-2 text-blue-600 font-semibold text-sm py-2"
              >
                <Plus className="w-4 h-4" />
                Ajouter une prestation
              </button>
            </div>
          </section>

          {/* Totaux */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total HT</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(totalHT)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">TVA</span>
                  <select
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    className="text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"
                  >
                    <option value={0}>0%</option>
                    <option value={5.5}>5.5%</option>
                    <option value={10}>10%</option>
                    <option value={20}>20%</option>
                  </select>
                </div>
                <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2.5">
                <span className="font-black text-slate-900">Total TTC</span>
                <span className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</span>
              </div>
            </div>
          </section>

          {/* Notes client */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Notes pour le client <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Conditions de règlement, délai d'intervention..."
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
          </section>

          {/* Validité */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Validité du devis</span>
              <div className="flex items-center gap-2">
                <select
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                >
                  <option value={15}>15 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={60}>60 jours</option>
                  <option value={90}>90 jours</option>
                </select>
              </div>
            </div>
          </section>

          {/* CTA */}
          <Button size="xl" onClick={() => saveEstimate("sent")} loading={sending} className="w-full">
            <Send className="w-5 h-5" />
            Envoyer le devis
          </Button>

          <div className="h-6" />
        </div>
      </div>

      {/* Client Picker Modal */}
      {showClientPicker && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
          <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowClientPicker(false)} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-600" />
              </button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  placeholder="Rechercher un client..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-base focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 px-4 py-2">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => { setSelectedClient(client); setShowClientPicker(false); setClientSearch(""); }}
                className="w-full flex items-center gap-3 py-3.5 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-slate-600">{client.full_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{client.full_name}</p>
                  {client.company_name && <p className="text-sm text-slate-500">{client.company_name}</p>}
                  {client.phone && <p className="text-sm text-slate-400">{client.phone}</p>}
                </div>
              </button>
            ))}
            {filteredClients.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-slate-400">Aucun client trouvé</p>
                <button
                  onClick={() => { setShowClientPicker(false); router.push("/clients/nouveau?return=devis"); }}
                  className="mt-3 text-blue-600 font-semibold text-sm"
                >
                  + Créer "{clientSearch}"
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Composant pour une ligne de devis
function LineRow({
  line, index, onUpdate, onRemove, onDescriptionChange,
  suggestions, onSuggestionApply, onSuggestionDismiss, canRemove,
}: {
  line: LineItem;
  index: number;
  onUpdate: (id: string, field: keyof LineItem, value: unknown) => void;
  onRemove: (id: string) => void;
  onDescriptionChange: (id: string, value: string) => void;
  suggestions: LibraryItem[];
  onSuggestionApply: (item: LibraryItem) => void;
  onSuggestionDismiss: () => void;
  canRemove: boolean;
}) {
  const lineTotal = line.quantity * line.unit_price * (1 - line.discount / 100);

  if (line.is_section) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50">
        <Tag className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          value={line.description}
          onChange={(e) => onDescriptionChange(line.id, e.target.value)}
          placeholder="Titre de section..."
          className="flex-1 bg-transparent text-sm font-bold text-slate-700 focus:outline-none placeholder:text-slate-400"
        />
        <button onClick={() => onRemove(line.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 relative">
      {/* Description avec autocomplétion */}
      <div className="relative mb-2">
        <input
          value={line.description}
          onChange={(e) => onDescriptionChange(line.id, e.target.value)}
          placeholder={`Prestation ${index + 1}...`}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:border-blue-500 pr-8"
        />
        {canRemove && (
          <button
            onClick={() => onRemove(line.id)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
            {suggestions.map((item) => (
              <button
                key={item.id}
                onClick={() => onSuggestionApply(item)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0"
              >
                <span className="text-sm font-medium text-slate-800">{item.description}</span>
                <span className="text-sm font-bold text-blue-600 tabular-nums">{formatCurrency(item.unit_price)}/{item.unit}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Qté / Unité / Prix unitaire */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Qté</label>
          <input
            type="number"
            value={line.quantity}
            onChange={(e) => onUpdate(line.id, "quantity", parseFloat(e.target.value) || 0)}
            min="0"
            step="0.5"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-semibold text-slate-900 focus:outline-none focus:border-blue-500 text-center"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Unité</label>
          <select
            value={line.unit}
            onChange={(e) => onUpdate(line.id, "unit", e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-base font-semibold text-slate-900 focus:outline-none focus:border-blue-500 text-center appearance-none"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Prix u. €</label>
          <input
            type="number"
            value={line.unit_price}
            onChange={(e) => onUpdate(line.id, "unit_price", parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-semibold text-slate-900 focus:outline-none focus:border-blue-500 text-right"
          />
        </div>
      </div>

      {/* Total ligne */}
      <div className="flex justify-end mt-2">
        <span className="text-sm font-black text-slate-700 tabular-nums">
          = {formatCurrency(lineTotal)}
        </span>
      </div>
    </div>
  );
}
