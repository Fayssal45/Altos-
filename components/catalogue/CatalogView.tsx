"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Wrench, Package, Layers, Euro, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { LibraryItem, Business, CatalogItemType, PackItem } from "@/lib/types";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

// ── Config per tab ────────────────────────────────────────────────────────────

type TabCfg = {
  label: string;
  icon: React.ElementType;
  accent: string;        // text color
  accentBg: string;      // bg for icon
  border: string;        // active tab border
  btnBg: string;         // add button bg
  categories: string[];
  units: string[];
  defaultUnit: string;
  defaultCategory: string;
  empty: string;
};

const TAB: Record<CatalogItemType, TabCfg> = {
  service: {
    label: "Prestations",
    icon: Wrench,
    accent: "text-amber-600",
    accentBg: "bg-amber-100",
    border: "border-amber-500",
    btnBg: "bg-amber-500 hover:bg-amber-600",
    categories: ["Main d'œuvre", "Déplacement", "Études / Conception", "Autre"],
    units: ["h", "forfait", "jour", "u", "m", "m²", "m³"],
    defaultUnit: "h",
    defaultCategory: "Main d'œuvre",
    empty: "Ajoutez vos prestations réutilisables : main d'œuvre, déplacement, études…",
  },
  product: {
    label: "Produits",
    icon: Package,
    accent: "text-blue-600",
    accentBg: "bg-blue-100",
    border: "border-blue-500",
    btnBg: "bg-blue-600 hover:bg-blue-700",
    categories: ["Matériaux", "Fournitures", "Autre"],
    units: ["u", "m", "m²", "m³", "kg", "L", "forfait"],
    defaultUnit: "u",
    defaultCategory: "Matériaux",
    empty: "Ajoutez vos produits et pièces : matériaux, fournitures, équipements…",
  },
  pack: {
    label: "Packs",
    icon: Layers,
    accent: "text-violet-600",
    accentBg: "bg-violet-100",
    border: "border-violet-500",
    btnBg: "bg-violet-600 hover:bg-violet-700",
    categories: [],
    units: [],
    defaultUnit: "",
    defaultCategory: "",
    empty: "Créez des packs prédéfinis regroupant main d'œuvre et matériaux pour un type d'intervention.",
  },
};

// ── Item form state ───────────────────────────────────────────────────────────

interface ItemForm {
  description: string;
  unit: string;
  unit_price: string;
  category: string;
}

const emptyItemForm = (tab: CatalogItemType): ItemForm => ({
  description: "",
  unit: TAB[tab].defaultUnit,
  unit_price: "",
  category: TAB[tab].defaultCategory,
});

// ── Pack sub-item form ────────────────────────────────────────────────────────

interface PackSubItemForm {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  item_type: "service" | "product";
}

const emptyPackSubItem = (): PackSubItemForm => ({
  description: "",
  quantity: "1",
  unit: "h",
  unit_price: "",
  item_type: "service",
});

// ── Component ─────────────────────────────────────────────────────────────────

interface CatalogViewProps {
  business: Business | null;
  initialItems: LibraryItem[];
}

export default function CatalogView({ business, initialItems }: CatalogViewProps) {
  const supabase = createClient();
  const [items, setItems]       = useState<LibraryItem[]>(initialItems);
  const [tab, setTab]           = useState<CatalogItemType>("service");
  const [searchQ, setSearchQ]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]         = useState<ItemForm>(emptyItemForm("service"));
  // Pack-specific state
  const [packSubItems, setPackSubItems] = useState<PackSubItemForm[]>([emptyPackSubItem()]);
  const [saving, setSaving]     = useState(false);

  const cfg = TAB[tab];
  const Icon = cfg.icon;

  // Filtered + grouped items for current tab
  const tabItems = items.filter((i) => {
    const matchType = (i.type ?? "service") === tab;
    const q = searchQ.toLowerCase();
    const matchSearch = !q || i.description.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const grouped = tabItems.reduce<Record<string, LibraryItem[]>>((acc, item) => {
    const key = item.category || (tab === "pack" ? "Packs" : "Autre");
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const groupKeys = tab === "pack"
    ? ["Packs"]
    : Object.keys(grouped).sort((a, b) => {
        const cats = cfg.categories;
        return (cats.indexOf(a) ?? 99) - (cats.indexOf(b) ?? 99);
      });

  // ── Open form ──────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyItemForm(tab));
    setPackSubItems([emptyPackSubItem()]);
    setShowForm(true);
  };

  const openEdit = (item: LibraryItem) => {
    setEditingId(item.id);
    setForm({
      description: item.description,
      unit: item.unit,
      unit_price: item.unit_price > 0 ? String(item.unit_price) : "",
      category: item.category || "",
    });
    if (item.type === "pack" && item.pack_items?.length) {
      setPackSubItems(item.pack_items.map((pi) => ({
        description: pi.description,
        quantity: String(pi.quantity),
        unit: pi.unit,
        unit_price: String(pi.unit_price),
        item_type: pi.item_type,
      })));
    } else {
      setPackSubItems([emptyPackSubItem()]);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyItemForm(tab));
    setPackSubItems([emptyPackSubItem()]);
  };

  // ── Save (service / product) ───────────────────────────────────────────────
  const handleSaveItem = async () => {
    if (!form.description.trim()) { toast.error("La description est obligatoire"); return; }
    if (!business?.id) { toast.error("Configurez d'abord votre entreprise"); return; }
    setSaving(true);
    try {
      const payload = {
        description: form.description.trim(),
        unit: form.unit,
        unit_price: parseFloat(form.unit_price) || 0,
        category: form.category || null,
        type: tab,
        business_id: business.id,
      };
      if (editingId) {
        const { data, error } = await supabase.from("library_items").update(payload).eq("id", editingId).select().single();
        if (error) throw error;
        setItems((p) => p.map((i) => i.id === editingId ? { ...i, ...data } : i));
        toast.success("Mis à jour");
      } else {
        const { data, error } = await supabase.from("library_items").insert(payload).select().single();
        if (error) throw error;
        setItems((p) => [data, ...p]);
        toast.success(tab === "service" ? "Prestation ajoutée" : "Produit ajouté");
      }
      closeForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  // ── Save pack ──────────────────────────────────────────────────────────────
  const handleSavePack = async () => {
    if (!form.description.trim()) { toast.error("Donnez un nom au pack"); return; }
    if (!business?.id) return;
    const validSubs = packSubItems.filter((s) => s.description.trim());
    if (validSubs.length === 0) { toast.error("Ajoutez au moins un élément au pack"); return; }
    setSaving(true);
    try {
      const packItemsData: PackItem[] = validSubs.map((s) => ({
        description: s.description.trim(),
        quantity: parseFloat(s.quantity) || 1,
        unit: s.unit,
        unit_price: parseFloat(s.unit_price) || 0,
        item_type: s.item_type,
      }));
      const totalPrice = packItemsData.reduce((sum, pi) => sum + pi.quantity * pi.unit_price, 0);
      const payload = {
        description: form.description.trim(),
        type: "pack" as CatalogItemType,
        unit: "forfait",
        unit_price: totalPrice,
        category: null,
        pack_items: packItemsData,
        business_id: business.id,
      };
      if (editingId) {
        const { data, error } = await supabase.from("library_items").update(payload).eq("id", editingId).select().single();
        if (error) throw error;
        setItems((p) => p.map((i) => i.id === editingId ? { ...i, ...data } : i));
        toast.success("Pack mis à jour");
      } else {
        const { data, error } = await supabase.from("library_items").insert(payload).select().single();
        if (error) throw error;
        setItems((p) => [data, ...p]);
        toast.success("Pack créé !");
      }
      closeForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("library_items").delete().eq("id", id);
    setItems((p) => p.filter((i) => i.id !== id));
    toast.success("Supprimé");
  };

  // Pack total
  const packTotal = packSubItems.reduce(
    (s, pi) => s + (parseFloat(pi.quantity) || 1) * (parseFloat(pi.unit_price) || 0), 0
  );

  const totalCount = items.filter((i) => (i.type ?? "service") === tab).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Catalogue</h1>
            <p className="text-sm text-slate-500 mt-0.5">{totalCount} élément{totalCount !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={openAdd}
            className={cn("flex items-center gap-1.5 text-white text-sm font-bold px-4 h-10 rounded-xl", cfg.btnBg)}
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5 mb-3">
          {(["service", "product", "pack"] as CatalogItemType[]).map((t) => {
            const c = TAB[t];
            const TIcon = c.icon;
            const active = tab === t;
            const count = items.filter((i) => (i.type ?? "service") === t).length;
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setShowForm(false); setEditingId(null); setSearchQ(""); }}
                className={cn(
                  "flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-[12px] font-bold transition-all",
                  active ? cn("bg-white shadow-sm", c.accent) : "text-slate-400"
                )}
              >
                <TIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{c.label}</span>
                {count > 0 && (
                  <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full",
                    active ? cn(c.accentBg, c.accent) : "bg-slate-200 text-slate-400"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">

        {/* ── Search ── */}
        {totalCount > 0 && (
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={`Rechercher dans ${cfg.label.toLowerCase()}…`}
            className="w-full h-10 bg-white border-2 border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:border-blue-500"
          />
        )}

        {/* ── Add / Edit form ── */}
        {showForm && (
          <div className={cn("bg-white rounded-2xl border-2 shadow-sm p-4", cfg.border)}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", cfg.accentBg)}>
                <Icon className={cn("w-3.5 h-3.5", cfg.accent)} />
              </div>
              <p className="font-bold text-slate-900 flex-1">
                {editingId ? "Modifier" : tab === "service" ? "Nouvelle prestation" : tab === "product" ? "Nouveau produit" : "Nouveau pack"}
              </p>
              <button onClick={closeForm}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            {tab === "pack" ? (
              <PackForm
                name={form.description}
                onNameChange={(v) => setForm((f) => ({ ...f, description: v }))}
                subItems={packSubItems}
                onSubItemsChange={setPackSubItems}
                packTotal={packTotal}
                onSave={handleSavePack}
                saving={saving}
                onCancel={closeForm}
              />
            ) : (
              <SimpleItemForm
                form={form}
                onChange={setForm}
                cfg={cfg}
                onSave={handleSaveItem}
                saving={saving}
                onCancel={closeForm}
              />
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {tabItems.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", cfg.accentBg)}>
              <Icon className={cn("w-8 h-8", cfg.accent)} />
            </div>
            <div>
              <p className="font-bold text-slate-700">Aucun{tab === "pack" ? "" : "e"} {cfg.label.toLowerCase().replace("s", "").trim()} pour l&apos;instant</p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">{cfg.empty}</p>
            </div>
            <button onClick={openAdd} className={cn("flex items-center gap-1.5 text-white text-sm font-bold px-4 h-10 rounded-xl", cfg.btnBg)}>
              <Plus className="w-4 h-4" />
              Ajouter {tab === "service" ? "une prestation" : tab === "product" ? "un produit" : "un pack"}
            </button>
          </div>
        )}

        {/* ── Grouped list ── */}
        {groupKeys.map((catKey) => {
          const catItems = grouped[catKey] ?? [];
          if (catItems.length === 0) return null;
          return (
            <section key={catKey}>
              {tab !== "pack" && (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", cfg.accent)}>{catKey}</span>
                  <span className="text-[10px] text-slate-300">({catItems.length})</span>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {catItems.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    tab={tab}
                    cfg={cfg}
                    isLast={i === catItems.length - 1}
                    isEditing={editingId === item.id}
                    onEdit={() => openEdit(item)}
                    onDelete={() => handleDelete(item.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* ── Pack explanation ── */}
        {tab === "pack" && tabItems.length > 0 && (
          <p className="text-[11px] text-slate-400 text-center leading-relaxed px-2">
            Les packs s&apos;insèrent dans un devis en une seule action — ils se déploient en lignes individuelles avec main d&apos;œuvre et matériaux séparés.
          </p>
        )}

      </div>
    </div>
  );
}

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({ item, tab, cfg, isLast, isEditing, onEdit, onDelete }: {
  item: LibraryItem;
  tab: CatalogItemType;
  cfg: TabCfg;
  isLast: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showPack, setShowPack] = useState(false);

  return (
    <div className={cn(!isLast && "border-b border-slate-50")}>
      <div className={cn("flex items-start gap-3 px-4 py-3.5", isEditing && "bg-blue-50/50")}>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", cfg.accentBg)}>
          {tab === "service" && <Wrench className={cn("w-3.5 h-3.5", cfg.accent)} />}
          {tab === "product" && <Package className={cn("w-3.5 h-3.5", cfg.accent)} />}
          {tab === "pack" && <Layers className={cn("w-3.5 h-3.5", cfg.accent)} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-tight">{item.description}</p>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            {tab !== "pack" && (
              <span className="text-xs text-slate-400">{item.unit}</span>
            )}
            {item.unit_price > 0 && (
              <span className={cn("text-xs font-bold flex items-center gap-0.5", cfg.accent)}>
                <Euro className="w-2.5 h-2.5" />
                {formatCurrency(item.unit_price)}
                {tab !== "pack" && <span className="font-normal text-slate-400">/{item.unit}</span>}
              </span>
            )}
            {item.usage_count > 0 && (
              <span className="text-[10px] text-slate-300">utilisé {item.usage_count}×</span>
            )}
          </div>
          {/* Pack sub-items toggle */}
          {tab === "pack" && item.pack_items && item.pack_items.length > 0 && (
            <button
              onClick={() => setShowPack((v) => !v)}
              className={cn("flex items-center gap-1 mt-1.5 text-[11px] font-semibold", cfg.accent)}
            >
              <ChevronRight className={cn("w-3 h-3 transition-transform", showPack && "rotate-90")} />
              {item.pack_items.length} élément{item.pack_items.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0 self-center">
          <button onClick={onEdit} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200">
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <button onClick={onDelete} className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center active:bg-red-100">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
      {/* Pack expanded sub-items */}
      {tab === "pack" && showPack && item.pack_items && item.pack_items.length > 0 && (
        <div className="mx-4 mb-3 bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
          {item.pack_items.map((pi, i) => (
            <div key={i} className={cn("flex items-center gap-2 px-3 py-2", i < item.pack_items!.length - 1 && "border-b border-slate-100")}>
              <div className={cn("w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0",
                pi.item_type === "service" ? "bg-amber-100" : "bg-blue-100"
              )}>
                {pi.item_type === "service"
                  ? <Wrench className="w-2.5 h-2.5 text-amber-600" />
                  : <Package className="w-2.5 h-2.5 text-blue-600" />}
              </div>
              <p className="flex-1 text-xs font-medium text-slate-700 truncate">{pi.description}</p>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{pi.quantity} {pi.unit}</span>
              {pi.unit_price > 0 && (
                <span className="text-xs font-bold text-slate-600 flex-shrink-0 tabular-nums">
                  {formatCurrency(pi.quantity * pi.unit_price)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Simple item form (service / product) ──────────────────────────────────────
function SimpleItemForm({ form, onChange, cfg, onSave, saving, onCancel }: {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  cfg: TabCfg;
  onSave: () => void;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <input
        autoFocus
        value={form.description}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        placeholder="Description *"
        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-400 font-medium block mb-1">Unité</label>
          <select
            value={form.unit}
            onChange={(e) => onChange({ ...form, unit: e.target.value })}
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none appearance-none"
          >
            {cfg.units.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-medium block mb-1">Prix unitaire (€)</label>
          <input
            type="number" value={form.unit_price}
            onChange={(e) => onChange({ ...form, unit_price: e.target.value })}
            placeholder="0" min="0" step="0.01" inputMode="decimal"
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      {cfg.categories.length > 0 && (
        <select
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        >
          <option value="">Catégorie (optionnel)</option>
          {cfg.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      )}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60">
          <Check className="w-4 h-4" />{saving ? "…" : "Enregistrer"}
        </button>
        <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}

// ── Pack form ─────────────────────────────────────────────────────────────────
function PackForm({ name, onNameChange, subItems, onSubItemsChange, packTotal, onSave, saving, onCancel }: {
  name: string;
  onNameChange: (v: string) => void;
  subItems: PackSubItemForm[];
  onSubItemsChange: (items: PackSubItemForm[]) => void;
  packTotal: number;
  onSave: () => void;
  saving: boolean;
  onCancel: () => void;
}) {
  const updateSub = (i: number, field: keyof PackSubItemForm, value: string) => {
    onSubItemsChange(subItems.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };
  const addSub    = () => onSubItemsChange([...subItems, emptyPackSubItem()]);
  const removeSub = (i: number) => onSubItemsChange(subItems.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Nom du pack *  (ex: Remplacement robinet)"
        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
      />

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Éléments du pack</p>
        <button onClick={addSub}
          className="flex items-center gap-1 text-[11px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1.5 rounded-lg active:bg-violet-100">
          <Plus className="w-3 h-3" />Ajouter
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {subItems.map((sub, i) => (
          <div key={i} className="bg-slate-50 rounded-xl p-3 flex flex-col gap-2 relative">
            {/* Type toggle */}
            <div className="flex gap-1.5 mb-1">
              <button
                onClick={() => updateSub(i, "item_type", "service")}
                className={cn(
                  "flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg flex-1 justify-center transition-colors",
                  sub.item_type === "service"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-white text-slate-400 border border-slate-200"
                )}
              >
                <Wrench className="w-3 h-3" />Main d&apos;œuvre
              </button>
              <button
                onClick={() => updateSub(i, "item_type", "product")}
                className={cn(
                  "flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg flex-1 justify-center transition-colors",
                  sub.item_type === "product"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-white text-slate-400 border border-slate-200"
                )}
              >
                <Package className="w-3 h-3" />Matériau
              </button>
              {subItems.length > 1 && (
                <button onClick={() => removeSub(i)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 flex-shrink-0">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </button>
              )}
            </div>
            <input
              value={sub.description}
              onChange={(e) => updateSub(i, "description", e.target.value)}
              placeholder="Description *"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number" value={sub.quantity}
                onChange={(e) => updateSub(i, "quantity", e.target.value)}
                placeholder="Qté" min="0" step="0.5" inputMode="decimal"
                className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none"
              />
              <select
                value={sub.unit}
                onChange={(e) => updateSub(i, "unit", e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none appearance-none"
              >
                {["h", "forfait", "u", "m", "m²", "m³", "kg", "L", "jour"].map((u) => <option key={u}>{u}</option>)}
              </select>
              <div className="relative">
                <input
                  type="number" value={sub.unit_price}
                  onChange={(e) => updateSub(i, "unit_price", e.target.value)}
                  placeholder="Prix" min="0" step="0.01" inputMode="decimal"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none pr-5"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">€</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {packTotal > 0 && (
        <div className="flex justify-between items-center bg-violet-50 rounded-xl px-3 py-2.5">
          <span className="text-sm font-semibold text-violet-700">Total pack</span>
          <span className="text-sm font-black text-violet-700">{formatCurrency(packTotal)} HT</span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-violet-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60">
          <Check className="w-4 h-4" />{saving ? "…" : "Enregistrer le pack"}
        </button>
        <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
