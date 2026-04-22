"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import {
  Plus, Trash2, Send, Save, User, Search, X, ArrowLeft,
  Eye, Phone, Mail, Building2, Image, Video, Upload,
  ChevronDown, ChevronUp, CheckCircle2, Circle, Zap,
  Tag, FileText, Camera, Copy, BookUser,
  Wrench, Package, Layers,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
// generateEstimatePdfBlob is dynamically imported on demand (see handleShareSend)
import type { Business, Client, Estimate, EstimateItem, LibraryItem, EstimateAttachment } from "@/lib/types";
import { getSuggestionsForActivity, type TradeSuggestion } from "@/lib/trade-suggestions";
// imageCompression is dynamically imported on demand (see handleFileSelect)
import { cn } from "@/lib/utils";

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
  item_type: "service" | "product" | null;
}

interface AttachmentItem {
  id: string;
  url: string;
  storage_path: string;
  file_type: "photo" | "video";
  persisted: boolean;
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
  item_type: null,
});

// ─── Collapsible section wrapper ─────────────────────────────────────────────
function CollapseSection({
  label, icon, defaultOpen = false, badge, children,
}: {
  label: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
          {icon}
        </div>
        <span className="flex-1 text-sm font-bold text-slate-700">{label}</span>
        {badge !== undefined && badge !== 0 && (
          <span className="text-xs font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mr-1">
            {badge}
          </span>
        )}
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-50">{children}</div>}
    </section>
  );
}

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
    estimate?.items?.map((item: EstimateItem) => ({
      ...item,
      id: item.id,
      item_type: item.item_type ?? null,
    })) || [newLine(0)]
  );

  // Catalogue picker
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [catPickerTab, setCatPickerTab] = useState<"service" | "product" | "pack">("service");
  const [catSearch, setCatSearch] = useState("");
  const [catalogueItems, setCatalogueItems] = useState<LibraryItem[]>([]);

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

  // Autocomplétion
  const [suggestions, setSuggestions] = useState<LibraryItem[]>([]);
  const [activeSuggestionLine, setActiveSuggestionLine] = useState<string | null>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculs
  const realLines = lines.filter((l) => !l.is_section);
  const totalHT = realLines.reduce(
    (sum, l) => sum + l.quantity * l.unit_price * (1 - l.discount / 100), 0
  );
  const vatAmount = totalHT * (vatRate / 100);
  const totalTTC = totalHT + vatAmount;

  const hasClient = !!selectedClient;
  const hasLines = realLines.some((l) => l.description && l.unit_price > 0);
  const hasTotal = totalTTC > 0;

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

  const fetchCatalogueItems = useCallback(async (tab: "service" | "product" | "pack", search: string) => {
    if (!business?.id) return;
    let query = supabase
      .from("library_items")
      .select("*")
      .eq("business_id", business.id)
      .eq("type", tab)
      .order("usage_count", { ascending: false })
      .limit(50);
    if (search.length >= 2) query = query.ilike("description", `%${search}%`);
    const { data } = await query;
    setCatalogueItems(data || []);
  }, [business?.id]);

  const openCatPicker = () => {
    setShowCatPicker(true);
    setCatSearch("");
    fetchCatalogueItems(catPickerTab, "");
  };

  const addFromCatalogueItem = (item: LibraryItem) => {
    if (item.type === "pack" && item.pack_items && item.pack_items.length > 0) {
      // Add section header + one line per pack sub-item
      const sectionId = crypto.randomUUID();
      const newItems: LineItem[] = [
        {
          id: sectionId,
          description: item.description,
          quantity: 1,
          unit: item.unit,
          unit_price: 0,
          discount: 0,
          is_section: true,
          sort_order: lines.length,
          item_type: null,
        },
        ...item.pack_items.map((pi, i) => ({
          id: crypto.randomUUID(),
          description: pi.description,
          quantity: pi.quantity,
          unit: pi.unit,
          unit_price: pi.unit_price,
          discount: 0,
          is_section: false,
          sort_order: lines.length + 1 + i,
          item_type: pi.item_type as "service" | "product",
        })),
      ];
      setLines((prev) => [...prev, ...newItems]);
    } else {
      const lineId = crypto.randomUUID();
      setLines((prev) => [
        ...prev,
        {
          id: lineId,
          description: item.description,
          quantity: 1,
          unit: item.unit,
          unit_price: item.unit_price,
          discount: 0,
          is_section: false,
          sort_order: prev.length,
          item_type: item.type === "service" || item.type === "product" ? item.type : null,
        },
      ]);
    }
    supabase.from("library_items").update({ usage_count: item.usage_count + 1 }).eq("id", item.id);
    setShowCatPicker(false);
  };

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
    const id = crypto.randomUUID();
    setLines((prev) => [
      ...prev,
      { ...newLine(prev.length), id, is_section: isSection },
    ]);
    // Focus newly added line on next tick
    setTimeout(() => {
      const el = document.getElementById(`line-desc-${id}`);
      el?.focus();
    }, 50);
  };

  const addFromSuggestion = (s: TradeSuggestion) => {
    const id = crypto.randomUUID();
    setLines((prev) => [
      ...prev,
      {
        id,
        description: s.description,
        quantity: 1,
        unit: s.unit,
        unit_price: 0,
        discount: 0,
        is_section: false,
        sort_order: prev.length,
        item_type: null,
      },
    ]);
    // Focus price field for the new line
    setTimeout(() => {
      const el = document.getElementById(`line-price-${id}`);
      el?.focus();
      (el as HTMLInputElement | null)?.select();
    }, 50);
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

  // Upload pièces jointes
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !business?.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) { toast.error(`Maximum ${MAX_ATTACHMENTS} fichiers atteint`); return; }
    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) toast(`Seuls ${remaining} fichier(s) ajouté(s)`);
    setUploading(true);
    const uploaded: AttachmentItem[] = [];
    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { toast.error(`${file.name} dépasse ${MAX_FILE_SIZE_MB} Mo`); continue; }
      const isVideo = file.type.startsWith("video/");
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const filename = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      try {
        let fileToUpload: File | Blob = file;
        if (!isVideo && file.type.startsWith("image/")) {
          const imageCompression = (await import("browser-image-compression")).default;
          fileToUpload = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
        }
        const { error } = await supabase.storage.from("estimate-attachments").upload(filename, fileToUpload, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("estimate-attachments").getPublicUrl(filename);
        uploaded.push({ id: crypto.randomUUID(), url: publicUrl, storage_path: filename, file_type: isVideo ? "video" : "photo", persisted: false });
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message || String(err);
        toast.error(`Upload échoué : ${msg}`);
      }
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = async (item: AttachmentItem) => {
    await supabase.storage.from("estimate-attachments").remove([item.storage_path]);
    if (item.persisted) await supabase.from("estimate_attachments").delete().eq("id", item.id);
    setAttachments((prev) => prev.filter((a) => a.id !== item.id));
  };

  // Sauvegarde
  const saveEstimate = async (status: "draft" | "sent" = "draft") => {
    if (!business?.id) { toast.error("Configurez d'abord votre entreprise"); return; }
    const isSending = status === "sent";
    if (isSending) setSending(true); else setSaving(true);
    try {
      let estimateId = estimate?.id;
      if (mode === "create") {
        const { data: numData } = await supabase.rpc("generate_estimate_number", { p_business_id: business.id });
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
        const { error } = await supabase.from("estimates").update({
          client_id: selectedClient?.id || null,
          status,
          title,
          vat_rate: vatRate,
          client_notes: clientNotes,
          validity_days: validityDays,
        }).eq("id", estimateId);
        if (error) throw error;
        await supabase.from("estimate_items").delete().eq("estimate_id", estimateId);
      }
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
          item_type: line.item_type ?? null,
        }));
        const { error: itemsError } = await supabase.from("estimate_items").insert(items);
        if (itemsError) throw itemsError;
        await Promise.all(lines.map(saveToLibrary));
        const newAttachments = attachments.filter((a) => !a.persisted);
        if (newAttachments.length > 0) {
          const rows = newAttachments.map((a, i) => ({
            estimate_id: estimateId,
            url: a.url,
            storage_path: a.storage_path,
            file_type: a.file_type,
            sort_order: attachments.filter((x) => x.persisted).length + i,
          }));
          await supabase.from("estimate_attachments").insert(rows);
          setAttachments((prev) => prev.map((a) => a.persisted ? a : { ...a, persisted: true }));
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

  const tradeSuggestions = getSuggestionsForActivity(business?.activity);

  // Duplicate current estimate (only available in edit mode)
  const [duplicating, setDuplicating] = useState(false);
  const handleDuplicate = async () => {
    if (!estimate || !business?.id) return;
    setDuplicating(true);
    try {
      const { data: numData } = await supabase.rpc("generate_estimate_number", { p_business_id: business.id });
      const { data: newEst, error } = await supabase
        .from("estimates")
        .insert({
          business_id: business.id,
          client_id: selectedClient?.id || null,
          number: numData,
          status: "draft",
          title: `${title || "Devis"} (copie)`,
          vat_rate: vatRate,
          client_notes: clientNotes,
          validity_days: validityDays,
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + validityDays * 86400000).toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      const items = lines.map((line, i) => ({
        estimate_id: newEst.id,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        discount: line.discount,
        sort_order: i,
        is_section: line.is_section,
        item_type: line.item_type ?? null,
      }));
      await supabase.from("estimate_items").insert(items);
      toast.success("Devis dupliqué !");
      router.push(`/devis/${newEst.id}/edit`);
    } catch {
      toast.error("Erreur lors de la duplication");
    } finally {
      setDuplicating(false);
    }
  };

  // Import contact from phone (Contact Picker API)
  const importContact = async () => {
    // @ts-ignore – Contact Picker API not in all TS lib versions
    if (!("contacts" in navigator) || !navigator.contacts?.select) {
      toast("Cette fonctionnalité n'est pas disponible sur ce navigateur", { icon: "ℹ️" });
      return;
    }
    try {
      // @ts-ignore
      const results = await navigator.contacts.select(["name", "tel", "email", "address"], { multiple: false });
      if (!results?.length) return;
      const contact = results[0];
      const fullName = contact.name?.[0] || "";
      const phone = contact.tel?.[0] || "";
      const email = contact.email?.[0] || "";
      const address = contact.address?.[0]?.addressLine?.[0] || "";
      const city = contact.address?.[0]?.city || "";
      const postalCode = contact.address?.[0]?.postalCode || "";
      if (!fullName) { toast.error("Nom introuvable dans le contact"); return; }
      // Create client in Supabase
      if (!business?.id) { toast.error("Configurez d'abord votre entreprise"); return; }
      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({ business_id: business.id, full_name: fullName, phone: phone || null, email: email || null, address: address || null, city: city || null, postal_code: postalCode || null })
        .select()
        .single();
      if (error) throw error;
      setSelectedClient(newClient as Client);
      setShowClientPicker(false);
      toast.success(`${fullName} importé depuis vos contacts`);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "";
      if (!msg.includes("cancelled") && !msg.includes("abort")) {
        toast.error("Impossible d'accéder aux contacts");
      }
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100">
        <div className="px-3 py-2 flex items-center gap-1.5">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>

          {/* Client + titre : flex-1 absorbs space so action buttons never wrap */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5 overflow-hidden">
            <button
              onClick={() => setShowClientPicker(true)}
              className="flex items-center gap-1 max-w-fit"
            >
              {selectedClient ? (
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 rounded-md px-1.5 py-0.5 truncate max-w-[130px] block">
                  {selectedClient.full_name}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                  <User className="w-2.5 h-2.5" />
                  Client
                </span>
              )}
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Objet du devis…"
              className="text-[13px] font-bold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400 truncate w-full"
            />
          </div>

          {/* Secondary icon-only actions */}
          {mode === "edit" && estimate && (
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              title="Dupliquer"
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"
            >
              {duplicating
                ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                : <Copy className="w-3.5 h-3.5 text-slate-600" />}
            </button>
          )}
          <button
            onClick={() => saveEstimate("draft")}
            disabled={saving}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"
          >
            {saving
              ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <Save className="w-3.5 h-3.5 text-slate-600" />}
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"
          >
            <Eye className="w-3.5 h-3.5 text-slate-600" />
          </button>

          {/* Primary CTA — visually dominant but compact */}
          <button
            onClick={() => saveEstimate("sent")}
            disabled={sending}
            className="flex items-center gap-1.5 bg-blue-600 active:bg-blue-700 text-white text-[13px] font-bold rounded-xl px-3 h-8 flex-shrink-0 disabled:opacity-60 transition-colors"
          >
            {sending
              ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
            Envoyer
          </button>
        </div>
      </div>

      {/* ── SCROLL AREA ── */}
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4 py-4 flex flex-col gap-3">

          {/* ── CLIENT (si pas encore sélectionné) ── */}
          {!selectedClient && (
            <button
              onClick={() => setShowClientPicker(true)}
              className="w-full flex items-center gap-3 bg-white border-2 border-dashed border-blue-200 rounded-2xl px-4 py-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">Ajouter un client</p>
                <p className="text-xs text-slate-400">Optionnel · vous pouvez ajouter plus tard</p>
              </div>
              <Plus className="w-5 h-5 text-blue-400 flex-shrink-0" />
            </button>
          )}

          {/* ── AJOUT RAPIDE ── */}
          {tradeSuggestions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                <Zap className="w-3 h-3" />
                Ajout rapide
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {tradeSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => addFromSuggestion(s)}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 active:scale-95 transition-transform shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── PRESTATIONS ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">
                Prestations
                {realLines.length > 0 && (
                  <span className="ml-2 text-xs font-bold text-slate-400">({realLines.length})</span>
                )}
              </h2>
              <button
                onClick={() => addLine(true)}
                className="text-xs text-slate-500 font-semibold px-2.5 py-1.5 rounded-xl bg-slate-100 flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                Section
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
                  onSuggestionDismiss={() => { setSuggestions([]); setActiveSuggestionLine(null); }}
                  canRemove={lines.length > 1}
                />
              ))}
            </div>

            <div className="px-4 py-3 border-t border-slate-50 flex gap-2">
              <button
                onClick={() => addLine(false)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm active:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter une ligne
              </button>
              <button
                onClick={openCatPicker}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm active:bg-slate-200 transition-colors flex-shrink-0"
              >
                <Layers className="w-4 h-4" />
                Catalogue
              </button>
            </div>
          </section>

          {/* ── RÉCAPITULATIF ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 space-y-2.5">

              <TypeTotals lines={lines} />
              <SectionTotals lines={lines} />

              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Total HT</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(totalHT)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 font-medium">TVA</span>
                  <select
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    className="text-sm font-bold text-slate-700 bg-slate-100 rounded-xl px-2.5 py-1.5 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value={0}>0% (franchise TVA)</option>
                    <option value={6}>6%</option>
                    <option value={12}>12%</option>
                    <option value={21}>21%</option>
                  </select>
                </div>
                <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(vatAmount)}</span>
              </div>

              {vatRate === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  TVA non applicable – art. 56bis du Code TVA belge
                </p>
              )}
            </div>

            {/* Big total */}
            <div className="mx-3 mb-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl px-4 py-4 flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-xs font-semibold">TOTAL TTC</p>
                <p className="text-3xl font-black text-white tabular-nums">{formatCurrency(totalTTC)}</p>
              </div>
              {hasClient && hasLines && hasTotal ? (
                <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span className="text-white text-xs font-bold">Prêt</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2">
                  <Circle className="w-4 h-4 text-blue-300" />
                  <span className="text-blue-300 text-xs font-semibold">En cours</span>
                </div>
              )}
            </div>
          </section>

          {/* ── SECTIONS SECONDAIRES COLLAPSÉES ── */}

          {/* Photos & vidéos */}
          <CollapseSection
            label="Photos & Vidéos"
            icon={<Camera className="w-4 h-4" />}
            badge={attachments.length || undefined}
          >
            <AttachmentSection
              attachments={attachments}
              uploading={uploading}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onRemove={removeAttachment}
            />
          </CollapseSection>

          {/* Notes & conditions */}
          <CollapseSection
            label="Notes & conditions client"
            icon={<FileText className="w-4 h-4" />}
          >
            <div className="px-4 py-3">
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Conditions de règlement, délai d'intervention, garanties…"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                rows={4}
              />
            </div>
          </CollapseSection>

          {/* Validité */}
          <CollapseSection
            label={`Validité · ${validityDays} jours`}
            icon={<Eye className="w-4 h-4" />}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Validité du devis</span>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="text-sm font-bold text-slate-700 bg-slate-100 rounded-xl px-3 py-2 focus:outline-none"
              >
                <option value={15}>15 jours</option>
                <option value={30}>30 jours</option>
                <option value={60}>60 jours</option>
                <option value={90}>90 jours</option>
              </select>
            </div>
          </CollapseSection>

        </div>
      </div>

      {/* ── STICKY BOTTOM CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-100 px-4 py-3 pb-safe">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            size="xl"
            variant="outline"
            onClick={() => setShowPreview(true)}
            className="flex-1"
          >
            <Eye className="w-5 h-5" />
            Aperçu
          </Button>
          <Button
            size="xl"
            onClick={() => saveEstimate("sent")}
            loading={sending}
            className="flex-[2]"
          >
            <Send className="w-5 h-5" />
            Envoyer le devis
          </Button>
        </div>
      </div>

      {/* ── CLIENT PICKER ── */}
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
                  placeholder="Rechercher un client…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-base focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={importContact}
                title="Importer depuis les contacts"
                className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0"
              >
                <BookUser className="w-4 h-4 text-emerald-700" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 px-4 py-1">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => { setSelectedClient(client); setShowClientPicker(false); setClientSearch(""); }}
                className="w-full flex items-center gap-3 py-2.5 text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-blue-700">{client.full_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{client.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {client.phone || client.company_name || ""}
                  </p>
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
                  + Créer « {clientSearch} »
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CATALOGUE PICKER ── */}
      {showCatPicker && (
        <CataloguePicker
          tab={catPickerTab}
          search={catSearch}
          items={catalogueItems}
          onTabChange={(t) => { setCatPickerTab(t); fetchCatalogueItems(t, catSearch); }}
          onSearchChange={(s) => { setCatSearch(s); fetchCatalogueItems(catPickerTab, s); }}
          onSelect={addFromCatalogueItem}
          onClose={() => setShowCatPicker(false)}
        />
      )}

      {/* ── APERÇU ── */}
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

// ─── Completion pill ──────────────────────────────────────────────────────────
function CompletionPill({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={cn(
      "flex items-center gap-1 text-[10px] font-bold rounded-lg px-2 py-0.5",
      done ? "text-emerald-700 bg-emerald-50" : "text-slate-400 bg-slate-100"
    )}>
      {done
        ? <CheckCircle2 className="w-3 h-3" />
        : <Circle className="w-3 h-3" />}
      {label}
    </span>
  );
}

// ─── Line row ─────────────────────────────────────────────────────────────────
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
  const [expanded, setExpanded] = useState(false);

  if (line.is_section) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50">
        <Tag className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          value={line.description}
          onChange={(e) => onDescriptionChange(line.id, e.target.value)}
          placeholder="Titre de section…"
          className="flex-1 bg-transparent text-sm font-black text-slate-700 focus:outline-none placeholder:text-slate-400 uppercase tracking-wide"
        />
        <button onClick={() => onRemove(line.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const borderColor = line.item_type === "service"
    ? "border-l-amber-400"
    : line.item_type === "product"
    ? "border-l-blue-400"
    : "border-l-transparent";

  return (
    <div className={cn("px-4 py-3 relative border-l-4", borderColor)}>
      {/* Row 1: description */}
      <div className="relative mb-2">
        <input
          id={`line-desc-${line.id}`}
          value={line.description}
          onChange={(e) => onDescriptionChange(line.id, e.target.value)}
          placeholder={`Prestation ${index + 1}…`}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-500 pr-8"
        />
        {canRemove && (
          <button
            onClick={() => onRemove(line.id)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-300 active:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
            {suggestions.map((item) => (
              <button
                key={item.id}
                onClick={() => onSuggestionApply(item)}
                className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-blue-50 border-b border-slate-50 last:border-0"
              >
                <span className="text-sm font-medium text-slate-800">{item.description}</span>
                <span className="text-sm font-bold text-blue-600 tabular-nums">{formatCurrency(item.unit_price)}/{item.unit}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Type badge row */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={() => onUpdate(line.id, "item_type", line.item_type === "service" ? null : "service")}
          className={cn(
            "flex items-center gap-1 text-[10px] font-bold rounded-lg px-2 py-1 transition-colors",
            line.item_type === "service"
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-400"
          )}
        >
          <Wrench className="w-2.5 h-2.5" />
          M.O.
        </button>
        <button
          onClick={() => onUpdate(line.id, "item_type", line.item_type === "product" ? null : "product")}
          className={cn(
            "flex items-center gap-1 text-[10px] font-bold rounded-lg px-2 py-1 transition-colors",
            line.item_type === "product"
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-400"
          )}
        >
          <Package className="w-2.5 h-2.5" />
          MAT.
        </button>
      </div>

      {/* Row 2: qty × price = total + toggle details */}
      <div className="flex items-center gap-2">
        {/* Qty */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => onUpdate(line.id, "quantity", Math.max(0, line.quantity - 1))}
            className="px-2.5 py-2 text-slate-500 font-bold text-sm active:bg-slate-100"
          >−</button>
          <input
            type="number"
            value={line.quantity}
            onChange={(e) => onUpdate(line.id, "quantity", parseFloat(e.target.value) || 0)}
            min="0"
            step="0.5"
            className="w-10 bg-transparent text-sm font-bold text-slate-900 focus:outline-none text-center"
          />
          <button
            onClick={() => onUpdate(line.id, "quantity", line.quantity + 1)}
            className="px-2.5 py-2 text-slate-500 font-bold text-sm active:bg-slate-100"
          >+</button>
        </div>

        {/* Unit */}
        <select
          value={line.unit}
          onChange={(e) => onUpdate(line.id, "unit", e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 focus:outline-none appearance-none text-center"
        >
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>

        {/* Separator */}
        <span className="text-slate-300 text-sm font-medium">×</span>

        {/* Unit price */}
        <div className="flex-1 relative">
          <input
            id={`line-price-${line.id}`}
            type="number"
            value={line.unit_price || ""}
            onChange={(e) => onUpdate(line.id, "unit_price", parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            placeholder="0,00"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 text-right pr-6"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">€</span>
        </div>

        {/* Toggle discount */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0",
            hasDiscount ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
          )}
          title="Remise"
        >
          %
        </button>
      </div>

      {/* Row 3: discount + total (expanded or just total) */}
      {expanded && (
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-slate-400 font-medium">Remise</label>
          <input
            type="number"
            value={line.discount || ""}
            onChange={(e) => onUpdate(line.id, "discount", parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            step="1"
            placeholder="0"
            className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 text-center"
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
      )}

      {/* Line total */}
      <div className="flex items-center justify-end gap-2 mt-2">
        {hasDiscount && (
          <span className="text-xs text-slate-300 line-through tabular-nums">
            {formatCurrency(line.quantity * line.unit_price)}
          </span>
        )}
        <span className={cn(
          "text-sm font-black tabular-nums",
          lineTotal > 0 ? (hasDiscount ? "text-emerald-600" : "text-slate-800") : "text-slate-300"
        )}>
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
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sous-totaux</p>
      {sections.map((s, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span className="text-slate-600 font-medium truncate">{s.name}</span>
          <span className="font-bold text-slate-800 tabular-nums flex-shrink-0 ml-2">{formatCurrency(s.total)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Sous-totaux MO / MAT ─────────────────────────────────────────────────────
function TypeTotals({ lines }: { lines: LineItem[] }) {
  const realLines = lines.filter((l) => !l.is_section);
  const moTotal = realLines
    .filter((l) => l.item_type === "service")
    .reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount / 100), 0);
  const matTotal = realLines
    .filter((l) => l.item_type === "product")
    .reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount / 100), 0);
  if (moTotal === 0 && matTotal === 0) return null;
  return (
    <div className="flex gap-2 mb-1">
      {moTotal > 0 && (
        <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Wrench className="w-3 h-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Main d&apos;œuvre</span>
          </div>
          <span className="text-sm font-black text-amber-800 tabular-nums">{formatCurrency(moTotal)}</span>
        </div>
      )}
      {matTotal > 0 && (
        <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Package className="w-3 h-3 text-blue-600" />
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Matériaux</span>
          </div>
          <span className="text-sm font-black text-blue-800 tabular-nums">{formatCurrency(matTotal)}</span>
        </div>
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
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="p-4">
      {count > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {attachments.map((item) => (
            <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
              {item.file_type === "video" ? (
                <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute bottom-1 left-1">
                {item.file_type === "video"
                  ? <div className="bg-black/60 rounded-md px-1.5 py-0.5 flex items-center gap-1"><Video className="w-2.5 h-2.5 text-white" /><span className="text-[10px] text-white font-medium">Vidéo</span></div>
                  : <div className="bg-black/60 rounded-md p-1"><Image className="w-2.5 h-2.5 text-white" /></div>}
              </div>
              <button onClick={() => onRemove(item)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <X className="w-3 h-3 text-white" />
              </button>
              {!item.persisted && <div className="absolute top-1 left-1 w-2 h-2 bg-amber-400 rounded-full" />}
            </div>
          ))}
        </div>
      )}
      {canAdd && (
        <>
          {/* Gallery input */}
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={onFileSelect} className="hidden" />
          {/* Camera input */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onFileSelect} className="hidden" />

          {uploading ? (
            <div className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3.5 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              Upload en cours…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 rounded-xl py-3 text-blue-700 font-semibold text-sm"
              >
                <Camera className="w-4 h-4" />
                Prendre une photo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 rounded-xl py-3 text-slate-600 font-semibold text-sm"
              >
                <Upload className="w-4 h-4" />
                Galerie
              </button>
            </div>
          )}
          <p className="text-xs text-slate-400 text-center mt-2">{MAX_ATTACHMENTS - count} emplacement{MAX_ATTACHMENTS - count > 1 ? "s" : ""} restant{MAX_ATTACHMENTS - count > 1 ? "s" : ""}</p>
        </>
      )}
      {!canAdd && <p className="text-center text-sm text-slate-400 py-2">Limite de {MAX_ATTACHMENTS} fichiers atteinte</p>}
    </div>
  );
}

// ─── Catalogue Picker ────────────────────────────────────────────────────────
const CAT_TABS: { key: "service" | "product" | "pack"; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "service", label: "Prestations", icon: <Wrench className="w-4 h-4" />, color: "text-amber-600 border-amber-500 bg-amber-50" },
  { key: "product", label: "Produits", icon: <Package className="w-4 h-4" />, color: "text-blue-600 border-blue-500 bg-blue-50" },
  { key: "pack", label: "Packs", icon: <Layers className="w-4 h-4" />, color: "text-violet-600 border-violet-500 bg-violet-50" },
];

function CataloguePicker({
  tab, search, items, onTabChange, onSearchChange, onSelect, onClose,
}: {
  tab: "service" | "product" | "pack";
  search: string;
  items: LibraryItem[];
  onTabChange: (t: "service" | "product" | "pack") => void;
  onSearchChange: (s: string) => void;
  onSelect: (item: LibraryItem) => void;
  onClose: () => void;
}) {
  const activeTab = CAT_TABS.find((t) => t.key === tab)!;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              placeholder="Rechercher dans le catalogue…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-base focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {CAT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold border-2 transition-colors",
                tab === t.key ? t.color : "text-slate-400 border-slate-100 bg-white"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50 px-4 py-2">
        {items.length === 0 && (
          <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
            {activeTab.icon}
            <p className="text-sm font-medium">Aucune {activeTab.label.toLowerCase()} dans le catalogue</p>
            <p className="text-xs">Ajoutez-en depuis le Catalogue</p>
          </div>
        )}
        {items.map((item) => {
          const isPack = item.type === "pack";
          const packTotal = isPack && item.pack_items
            ? item.pack_items.reduce((s, pi) => s + pi.quantity * pi.unit_price, 0)
            : null;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="w-full flex items-start gap-3 py-3.5 text-left active:bg-slate-50"
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                item.type === "service" ? "bg-amber-100" : item.type === "product" ? "bg-blue-100" : "bg-violet-100"
              )}>
                {item.type === "service"
                  ? <Wrench className="w-4 h-4 text-amber-600" />
                  : item.type === "product"
                  ? <Package className="w-4 h-4 text-blue-600" />
                  : <Layers className="w-4 h-4 text-violet-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{item.description}</p>
                {isPack && item.pack_items && item.pack_items.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.pack_items.length} élément{item.pack_items.length > 1 ? "s" : ""}
                    {item.pack_items.map((pi) => pi.description).slice(0, 2).join(", ").length > 0
                      ? ` · ${item.pack_items.map((pi) => pi.description).slice(0, 2).join(", ")}${item.pack_items.length > 2 ? "…" : ""}`
                      : ""}
                  </p>
                )}
                {item.category && (
                  <span className="text-[10px] text-slate-400 font-medium">{item.category}</span>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black text-slate-900 tabular-nums">
                  {formatCurrency(packTotal !== null ? packTotal : item.unit_price)}
                </p>
                {!isPack && (
                  <p className="text-[10px] text-slate-400">/{item.unit}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
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
  const fmt = (d: Date) => d.toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" });

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
          {business?.logo_url
            ? <img src={business.logo_url} alt={business.name || ""} className="h-10 object-contain mb-2" />
            : <div className="flex items-center gap-2 mb-2"><Building2 className="w-6 h-6 text-blue-300" /><p className="text-2xl font-black">{business?.name || "Mon Entreprise"}</p></div>}
          {business?.activity && <p className="text-blue-200 text-sm">{business.activity}</p>}
        </div>
      </div>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-5">
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
            <div><p className="text-slate-400">Émis le</p><p className="font-semibold text-slate-900">{fmt(today)}</p></div>
            <div><p className="text-slate-400">Valable jusqu'au</p><p className="font-semibold text-slate-900">{fmt(expiresAt)}</p></div>
            {client && (
              <div className="col-span-2">
                <p className="text-slate-400">Destinataire</p>
                <p className="font-semibold text-slate-900">{client.full_name}</p>
                {client.company_name && <p className="text-sm text-slate-500">{client.company_name}</p>}
              </div>
            )}
          </div>
        </div>
        {attachments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Photos & Vidéos <span className="font-normal normal-case text-slate-400">({attachments.length})</span></h2>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2">
              {attachments.map((item) => (
                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                  {item.file_type === "video"
                    ? <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    : <img src={item.url} alt="" className="w-full h-full object-cover" />}
                  {item.file_type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"><Video className="w-4 h-4 text-white" /></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Détail des prestations</h2>
          </div>
          {lines.map((line) => {
            if (line.is_section) return (
              <div key={line.id} className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wide">{line.description || "Section"}</p>
              </div>
            );
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
                    {line.discount > 0 && <p className="text-xs text-slate-300 line-through tabular-nums">{formatCurrency(line.quantity * line.unit_price)}</p>}
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(lineTotal)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2.5">
          <div className="flex justify-between text-sm"><span className="text-slate-500">Total HT</span><span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(totalHT)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">TVA {vatRate}%</span><span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(vatAmount)}</span></div>
          {vatRate === 0 && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">TVA non applicable – art. 56bis du Code TVA belge</p>}
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
          <Button size="xl" variant="outline" onClick={onClose} className="w-full"><ArrowLeft className="w-5 h-5" />Modifier</Button>
          <Button size="xl" onClick={onSend} loading={sending} className="w-full"><Send className="w-5 h-5" />Envoyer</Button>
        </div>
        <div className="h-6" />
      </div>
    </div>
  );
}
