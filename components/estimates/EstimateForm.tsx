"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import {
  Plus, Trash2, Send, Save, User, Search, X, ArrowLeft, Tag,
  Eye, Phone, Mail, Building2, Image, Video, Upload,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Business, Client, Estimate, EstimateItem, LibraryItem, EstimateAttachment } from "@/lib/types";
import { getSuggestionsForActivity, type TradeSuggestion } from "@/lib/trade-suggestions";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import imageCompression from "browser-image-compression";

const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE_MB = 50;

interface EstimateFormProps {
  business: Business | null;
  clients: Client[];
  mode: "create" | "edit";
  estimate?: Estimate;
  existingAttachments?: EstimateAttachment[];
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

// Attachment tracked in form state
interface AttachmentItem {
  id: string;           // UUID (temp for new, real for persisted)
  url: string;
  storage_path: string;
  file_type: "photo" | "video";
  persisted: boolean;   // true = already in DB
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

export default function EstimateForm({
  business, clients, mode, estimate, existingAttachments = [],
}: EstimateFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Client
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
    estimate?.items?.map((item) => ({ ...item, id: item.id })) || [newLine(0)]
  );

  // Pièces jointes
  const [attachments, setAttachments] = useState<AttachmentItem[]>(
    existingAttachments.map((a) => ({
      id: a.id,
      url: a.url,
      storage_path: a.storage_path,
      file_type: a.file_type,
      persisted: true,
    }))
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Autocomplétion catalogue
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !business?.id) { setSuggestions([]); return; }
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
      prev.map((l) =>
        l.id === lineId
          ? { ...l, description: item.description, unit_price: item.unit_price, unit: item.unit }
          : l
      )
    );
    setSuggestions([]);
    setActiveSuggestionLine(null);
    supabase.from("library_items").update({ usage_count: item.usage_count + 1 }).eq("id", item.id);
  };

  const addLine = (isSection = false) => {
    setLines((prev) => [...prev, { ...newLine(prev.length), is_section: isSection }]);
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

  // ── Upload pièces jointes ─────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !business?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_ATTACHMENTS} fichiers atteint`);
      return;
    }

    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      toast(`Seuls ${remaining} fichier(s) ajouté(s) sur ${files.length} sélectionné(s)`);
    }

    setUploading(true);
    const uploaded: AttachmentItem[] = [];

    for (const file of toUpload) {
      // Vérification taille
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} dépasse ${MAX_FILE_SIZE_MB} Mo`);
        continue;
      }

      const isVideo = file.type.startsWith("video/");
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const filename = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

      try {
        let fileToUpload: File | Blob = file;

        // Compression photo uniquement
        if (!isVideo && file.type.startsWith("image/")) {
          fileToUpload = await imageCompression(file, {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
        }

        const { error } = await supabase.storage
          .from("estimate-attachments")
          .upload(filename, fileToUpload, { contentType: file.type, upsert: false });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from("estimate-attachments")
          .getPublicUrl(filename);

        uploaded.push({
          id: crypto.randomUUID(),
          url: publicUrl,
          storage_path: filename,
          file_type: isVideo ? "video" : "photo",
          persisted: false,
        });
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message || String(err);
        console.error("[upload]", file.name, msg);
        toast.error(`Upload échoué : ${msg}`);
      }
    }

    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);

    // Reset input pour permettre re-sélection du même fichier
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = async (item: AttachmentItem) => {
    // Supprimer du storage
    await supabase.storage.from("estimate-attachments").remove([item.storage_path]);

    // Supprimer de la DB si persisté
    if (item.persisted) {
      await supabase.from("estimate_attachments").delete().eq("id", item.id);
    }

    setAttachments((prev) => prev.filter((a) => a.id !== item.id));
  };

  // ── Sauvegarde ────────────────────────────────────────────────────────────
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

        await supabase.from("estimate_items").delete().eq("estimate_id", estimateId);
      }

      if (estimateId) {
        // Lignes
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

        await Promise.all(lines.map(saveToLibrary));

        // Pièces jointes non encore persistées
        const newAttachments = attachments.filter((a) => !a.persisted);
        if (newAttachments.length > 0) {
          const attachmentRows = newAttachments.map((a, i) => ({
            estimate_id: estimateId,
            url: a.url,
            storage_path: a.storage_path,
            file_type: a.file_type,
            sort_order: attachments.filter((x) => x.persisted).length + i,
          }));
          await supabase.from("estimate_attachments").insert(attachmentRows);
          // Marquer comme persistées en local
          setAttachments((prev) =>
            prev.map((a) => (a.persisted ? a : { ...a, persisted: true }))
          );
        }
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-slate-900 truncate">
              {mode === "create" ? "Nouveau Devis" : `Modifier ${estimate?.number || ""}`}
            </h1>
          </div>
          <Button size="sm" variant="outline" onClick={() => saveEstimate("draft")} loading={saving}>
            <Save className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="w-4 h-4" />
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
                <button
                  onClick={() => setSelectedClient(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"
                >
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
              label="Titre de l'intervention"
              placeholder="Ex: Installation électrique appartement T3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </section>

          {/* Suggestions */}
          <SuggestionsPanel
            activity={business?.activity}
            onApply={(suggestion) => {
              setTitle((prev) => prev || suggestion.title);
              addLine(false);
              setLines((prev) => {
                const last = prev[prev.length - 1];
                return prev.map((l) =>
                  l.id === last.id
                    ? { ...l, description: suggestion.description, unit: suggestion.unit }
                    : l
                );
              });
            }}
          />

          {/* Lignes de devis */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Prestations</h2>
              <button
                onClick={() => addLine(true)}
                className="text-xs text-slate-500 font-semibold px-2 py-1 rounded-lg bg-slate-50 border border-slate-200"
              >
                + Titre
              </button>
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
              <SectionTotals lines={lines} />
              <div className="flex justify-between text-sm pt-1">
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
                    <option value={0}>0% (franchise)</option>
                    <option value={5.5}>5,5%</option>
                    <option value={10}>10%</option>
                    <option value={20}>20%</option>
                  </select>
                </div>
                <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(vatAmount)}</span>
              </div>
              {vatRate === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  TVA non applicable – art. 56bis du Code TVA belge
                </p>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2.5">
                <span className="font-black text-slate-900">Total TTC</span>
                <span className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</span>
              </div>
            </div>
          </section>

          {/* Photos & Vidéos */}
          <AttachmentSection
            attachments={attachments}
            uploading={uploading}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
            onRemove={removeAttachment}
          />

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
          </section>

          {/* CTA */}
          <div className="grid grid-cols-2 gap-3">
            <Button size="xl" variant="outline" onClick={() => setShowPreview(true)} className="w-full">
              <Eye className="w-5 h-5" />
              Aperçu
            </Button>
            <Button size="xl" onClick={() => saveEstimate("sent")} loading={sending} className="w-full">
              <Send className="w-5 h-5" />
              Envoyer
            </Button>
          </div>

          <div className="h-6" />
        </div>
      </div>

      {/* Client Picker */}
      {showClientPicker && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
          <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowClientPicker(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"
              >
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
                onClick={() => {
                  setSelectedClient(client);
                  setShowClientPicker(false);
                  setClientSearch("");
                }}
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

      {/* Aperçu */}
      {showPreview && (
        <EstimatePreview
          business={business}
          client={selectedClient}
          title={title}
          lines={lines}
          vatRate={vatRate}
          totalHT={totalHT}
          vatAmount={vatAmount}
          totalTTC={totalTTC}
          clientNotes={clientNotes}
          validityDays={validityDays}
          estimateNumber={estimate?.number ?? undefined}
          attachments={attachments}
          onClose={() => setShowPreview(false)}
          onSend={() => { setShowPreview(false); saveEstimate("sent"); }}
          sending={sending}
        />
      )}
    </div>
  );
}

// ─── Section pièces jointes ───────────────────────────────────────────────────
function AttachmentSection({
  attachments, uploading, fileInputRef, onFileSelect, onRemove,
}: {
  attachments: AttachmentItem[];
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (item: AttachmentItem) => void;
}) {
  const count = attachments.length;
  const canAdd = count < MAX_ATTACHMENTS;
  const photos = attachments.filter((a) => a.file_type === "photo").length;
  const videos = attachments.filter((a) => a.file_type === "video").length;

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Photos & Vidéos</h2>
          {count > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              {photos > 0 && `${photos} photo${photos > 1 ? "s" : ""}`}
              {photos > 0 && videos > 0 && " · "}
              {videos > 0 && `${videos} vidéo${videos > 1 ? "s" : ""}`}
            </p>
          )}
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${count >= MAX_ATTACHMENTS ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
          {count}/{MAX_ATTACHMENTS}
        </span>
      </div>

      <div className="p-4">
        {/* Grille de miniatures */}
        {count > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {attachments.map((item) => (
              <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group">
                {item.file_type === "video" ? (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Badge type */}
                <div className="absolute bottom-1 left-1">
                  {item.file_type === "video" ? (
                    <div className="bg-black/60 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                      <Video className="w-2.5 h-2.5 text-white" />
                      <span className="text-[10px] text-white font-medium">Vidéo</span>
                    </div>
                  ) : (
                    <div className="bg-black/60 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                      <Image className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Bouton supprimer */}
                <button
                  onClick={() => onRemove(item)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-sm"
                >
                  <X className="w-3 h-3 text-white" />
                </button>

                {/* Indicateur non sauvegardé */}
                {!item.persisted && (
                  <div className="absolute top-1 left-1 w-2 h-2 bg-amber-400 rounded-full" title="Non sauvegardé" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bouton ajouter */}
        {canAdd ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={onFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3.5 text-slate-500 font-semibold text-sm active:scale-98 transition-transform disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Upload en cours…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Ajouter {count > 0 ? "d'autres " : ""}photos ou vidéos
                </>
              )}
            </button>
            <p className="text-xs text-slate-400 text-center mt-2">
              JPG, PNG, GIF, MP4, MOV · {MAX_FILE_SIZE_MB} Mo max · {MAX_ATTACHMENTS - count} emplacement{MAX_ATTACHMENTS - count > 1 ? "s" : ""} restant{MAX_ATTACHMENTS - count > 1 ? "s" : ""}
            </p>
          </>
        ) : (
          <p className="text-center text-sm text-slate-400 py-2">
            Limite de {MAX_ATTACHMENTS} fichiers atteinte
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Ligne de devis ───────────────────────────────────────────────────────────
function LineRow({
  line, index, onUpdate, onRemove, onDescriptionChange,
  suggestions, onSuggestionApply, canRemove,
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
  const hasDiscount = line.discount > 0;

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
      <div className="relative mb-2.5">
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

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Quantité</label>
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
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Prix unitaire (€)</label>
          <input
            type="number"
            value={line.unit_price}
            onChange={(e) => onUpdate(line.id, "unit_price", parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-semibold text-slate-900 focus:outline-none focus:border-blue-500 text-right"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">
            Remise (%)
            {!hasDiscount && <span className="text-slate-300 normal-case"> · optionnel</span>}
          </label>
          <input
            type="number"
            value={line.discount || ""}
            onChange={(e) => onUpdate(line.id, "discount", parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            step="1"
            placeholder="0"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-semibold text-slate-900 focus:outline-none focus:border-blue-500 text-center"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-2.5">
        {hasDiscount && (
          <span className="text-xs text-slate-400 line-through tabular-nums">
            {formatCurrency(line.quantity * line.unit_price)}
          </span>
        )}
        <span className={`text-sm font-black tabular-nums ${hasDiscount ? "text-emerald-600" : "text-slate-700"}`}>
          = {formatCurrency(lineTotal)} HT
        </span>
      </div>
    </div>
  );
}

// ─── Sous-totaux par section ──────────────────────────────────────────────────
function SectionTotals({ lines }: { lines: LineItem[] }) {
  const hasAnySections = lines.some((l) => l.is_section);
  if (!hasAnySections) return null;

  const sections: { name: string; total: number }[] = [];
  let currentSection = "";
  let currentTotal = 0;

  for (const line of lines) {
    if (line.is_section) {
      if (currentSection && currentTotal > 0) sections.push({ name: currentSection, total: currentTotal });
      currentSection = line.description || "Section";
      currentTotal = 0;
    } else {
      currentTotal += line.quantity * line.unit_price * (1 - line.discount / 100);
    }
  }
  if (currentSection && currentTotal > 0) sections.push({ name: currentSection, total: currentTotal });

  if (sections.length === 0) return null;

  return (
    <div className="bg-slate-50 rounded-xl p-3 mb-1 space-y-1.5">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sous-totaux par section</p>
      {sections.map((s, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span className="text-slate-600 font-medium truncate">{s.name}</span>
          <span className="font-bold text-slate-800 tabular-nums flex-shrink-0 ml-2">{formatCurrency(s.total)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Aperçu devis ─────────────────────────────────────────────────────────────
function EstimatePreview({
  business, client, title, lines, vatRate, totalHT, vatAmount, totalTTC,
  clientNotes, validityDays, estimateNumber, attachments, onClose, onSend, sending,
}: {
  business: Business | null;
  client: Client | null;
  title: string;
  lines: LineItem[];
  vatRate: number;
  totalHT: number;
  vatAmount: number;
  totalTTC: number;
  clientNotes: string;
  validityDays: number;
  estimateNumber?: string;
  attachments: AttachmentItem[];
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
}) {
  const today = new Date();
  const expiresAt = new Date(Date.now() + validityDays * 86400000);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 animate-slide-up overflow-y-auto">
      <div className="sticky top-0 z-10 bg-amber-400 text-amber-900 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-black uppercase tracking-wider">Aperçu · vue client</span>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
          <X className="w-4 h-4 text-amber-900" />
        </button>
      </div>

      <div className="bg-blue-600 text-white px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {business?.logo_url ? (
            <img src={business.logo_url} alt={business.name || ""} className="h-10 object-contain mb-2" />
          ) : (
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-6 h-6 text-blue-300" />
              <p className="text-2xl font-black">{business?.name || "Mon Entreprise"}</p>
            </div>
          )}
          {business?.activity && <p className="text-blue-200 text-sm">{business.activity}</p>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Infos devis */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <span className="text-xs font-mono text-slate-400">{estimateNumber || "DEV-XXXX-XXX"}</span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">{title || "Devis sans titre"}</h1>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</p>
              <p className="text-xs text-slate-400">TTC</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400">Émis le</p>
              <p className="font-semibold text-slate-900">{formatDate(today)}</p>
            </div>
            <div>
              <p className="text-slate-400">Valable jusqu'au</p>
              <p className="font-semibold text-slate-900">{formatDate(expiresAt)}</p>
            </div>
            {client && (
              <div className="col-span-2">
                <p className="text-slate-400">Destinataire</p>
                <p className="font-semibold text-slate-900">{client.full_name}</p>
                {client.company_name && <p className="text-sm text-slate-500">{client.company_name}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Photos & vidéos */}
        {attachments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Photos & Vidéos
                <span className="ml-2 font-normal normal-case text-slate-400">({attachments.length})</span>
              </h2>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2">
              {attachments.map((item) => (
                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                  {item.file_type === "video" ? (
                    <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  )}
                  {item.file_type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                        <Video className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lignes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Détail des prestations</h2>
          </div>
          {lines.map((line) => {
            if (line.is_section) {
              return (
                <div key={line.id} className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{line.description || "Section"}</p>
                </div>
              );
            }
            const lineTotal = line.quantity * line.unit_price * (1 - line.discount / 100);
            return (
              <div key={line.id} className="px-5 py-3.5 border-b border-slate-50 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{line.description || "—"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {line.quantity} {line.unit} × {formatCurrency(line.unit_price)}
                      {line.discount > 0 && <span className="text-emerald-600"> · {line.discount}% remise</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {line.discount > 0 && (
                      <p className="text-xs text-slate-300 line-through tabular-nums">
                        {formatCurrency(line.quantity * line.unit_price)}
                      </p>
                    )}
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(lineTotal)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totaux */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total HT</span>
            <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(totalHT)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">TVA {vatRate}%</span>
            <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(vatAmount)}</span>
          </div>
          {vatRate === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              TVA non applicable – art. 56bis du Code TVA belge
            </p>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2.5">
            <span className="font-black text-slate-900 text-lg">Total TTC</span>
            <span className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</span>
          </div>
        </div>

        {clientNotes && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-900 mb-1">Notes</p>
            <p className="text-sm text-amber-800 whitespace-pre-line">{clientNotes}</p>
          </div>
        )}

        {business && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">{business.name}</p>
            <div className="flex flex-col gap-2">
              {business.phone && <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="w-4 h-4 text-slate-400" />{business.phone}</div>}
              {business.email && <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="w-4 h-4 text-slate-400" />{business.email}</div>}
              {business.siret && <p className="text-xs text-slate-400">BCE/KBO : {business.siret}</p>}
              {business.vat_number && <p className="text-xs text-slate-400">TVA : {business.vat_number}</p>}
              {business.iban && <p className="text-xs text-slate-400">IBAN : {business.iban}</p>}
            </div>
          </div>
        )}

        <div className="bg-slate-100 rounded-2xl p-4 text-center">
          <p className="text-sm text-slate-500">Le client pourra signer électroniquement depuis ce devis</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button size="xl" variant="outline" onClick={onClose} className="w-full">
            <ArrowLeft className="w-5 h-5" />
            Modifier
          </Button>
          <Button size="xl" onClick={onSend} loading={sending} className="w-full">
            <Send className="w-5 h-5" />
            Envoyer
          </Button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}

// ─── Suggestions par métier ───────────────────────────────────────────────────
function SuggestionsPanel({ activity, onApply }: { activity?: string | null; onApply: (s: TradeSuggestion) => void }) {
  const [open, setOpen] = useState(false);
  const suggestions = getSuggestionsForActivity(activity);
  if (!suggestions.length) return null;

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Suggestions de prestations</p>
          <p className="text-xs text-slate-400">{activity ? `Pour ${activity}` : "Cliquez pour ajouter une prestation type"}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-50 px-3 py-3 flex flex-wrap gap-2">
          <p className="w-full text-xs text-slate-400 mb-1">Appuyez pour remplir la description · Le prix reste à votre charge</p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onApply(s)}
              className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 active:scale-95 transition-transform text-left"
            >
              <Plus className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              {s.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
