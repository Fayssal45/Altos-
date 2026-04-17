"use client";

import { useState } from "react";
import {
  Plus, Trash2, Edit2, Check, X, BookOpen, Tag, Euro,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { LibraryItem, Business } from "@/lib/types";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const UNITS = ["u", "h", "m", "m²", "m³", "forfait", "jour", "kg"];

const CATEGORIES = [
  "Main d'œuvre",
  "Matériaux",
  "Fournitures",
  "Déplacement",
  "Études / Conception",
  "Autre",
];

interface CatalogViewProps {
  business: Business | null;
  initialItems: LibraryItem[];
}

interface ItemForm {
  description: string;
  unit: string;
  unit_price: string;
  category: string;
}

const emptyForm = (): ItemForm => ({
  description: "",
  unit: "forfait",
  unit_price: "",
  category: "",
});

export default function CatalogView({ business, initialItems }: CatalogViewProps) {
  const supabase = createClient();
  const [items, setItems] = useState<LibraryItem[]>(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const grouped = items
    .filter((i) => {
      const q = searchQ.toLowerCase();
      return (
        (!q || i.description.toLowerCase().includes(q)) &&
        (filterCat === "all" || (i.category || "Autre") === filterCat)
      );
    })
    .reduce<Record<string, LibraryItem[]>>((acc, item) => {
      const cat = item.category || "Autre";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

  const usedCategories = Array.from(new Set(items.map((i) => i.category || "Autre"))).sort();

  const startEdit = (item: LibraryItem) => {
    setEditingId(item.id);
    setForm({
      description: item.description,
      unit: item.unit,
      unit_price: item.unit_price > 0 ? String(item.unit_price) : "",
      category: item.category || "",
    });
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    if (!form.description.trim()) {
      toast.error("La description est obligatoire");
      return;
    }
    if (!business?.id) {
      toast.error("Configurez d'abord votre entreprise");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        description: form.description.trim(),
        unit: form.unit,
        unit_price: parseFloat(form.unit_price) || 0,
        category: form.category || null,
        business_id: business.id,
      };

      if (editingId) {
        const { data, error } = await supabase
          .from("library_items")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
        if (error) throw error;
        setItems((prev) => prev.map((i) => (i.id === editingId ? data : i)));
        setEditingId(null);
        toast.success("Prestation mise à jour");
      } else {
        const { data, error } = await supabase
          .from("library_items")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setItems((prev) => [data, ...prev]);
        setShowForm(false);
        toast.success("Prestation ajoutée");
      }
      setForm(emptyForm());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("library_items").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Supprimé");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Mon Catalogue</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {items.length} prestation{items.length !== 1 ? "s" : ""} enregistrée{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4">

        {/* Formulaire d'ajout */}
        {showForm && (
          <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-slate-900">Nouvelle prestation</p>
              <button onClick={() => { setShowForm(false); setForm(emptyForm()); }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <ItemFormFields form={form} onChange={setForm} onSave={handleSave} saving={saving} />
          </div>
        )}

        {/* Search + filter */}
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Rechercher une prestation…"
              className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:border-blue-500"
            />
            {usedCategories.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterCat("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                    filterCat === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  Toutes
                </button>
                {usedCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                      filterCat === cat ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grouped list */}
        {Object.keys(grouped).length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Catalogue vide</p>
              <p className="text-sm text-slate-400 mt-1">
                Ajoutez vos prestations récurrentes pour les réutiliser rapidement dans vos devis
              </p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" />
              Ajouter ma première prestation
            </Button>
          </div>
        )}

        {Object.entries(grouped).map(([category, catItems]) => (
          <section key={category}>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{category}</h2>
              <span className="text-xs text-slate-300">({catItems.length})</span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {catItems.map((item, i) => (
                <div key={item.id}>
                  {editingId === item.id ? (
                    <div className="p-4 border-b border-slate-50 bg-blue-50/50">
                      <ItemFormFields form={form} onChange={setForm} onSave={handleSave} saving={saving} onCancel={cancelEdit} />
                    </div>
                  ) : (
                    <div className={cn(
                      "flex items-start gap-3 px-4 py-3.5",
                      i < catItems.length - 1 ? "border-b border-slate-50" : ""
                    )}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{item.unit}</span>
                          {item.unit_price > 0 && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs font-semibold text-blue-600 flex items-center gap-0.5">
                                <Euro className="w-3 h-3" />
                                {formatCurrency(item.unit_price)}
                              </span>
                            </>
                          )}
                          {item.usage_count > 0 && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">utilisé {item.usage_count}×</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => startEdit(item)}
                          className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="h-4" />
      </div>
    </div>
  );
}

// ── Formulaire inline ─────────────────────────────────────────────────────────
function ItemFormFields({
  form,
  onChange,
  onSave,
  saving,
  onCancel,
}: {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  onSave: () => void;
  saving: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <input
        autoFocus
        value={form.description}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        placeholder="Description de la prestation *"
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
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-medium block mb-1">Prix unitaire (€)</label>
          <input
            type="number"
            value={form.unit_price}
            onChange={(e) => onChange({ ...form, unit_price: e.target.value })}
            placeholder="0"
            min="0"
            step="0.01"
            inputMode="decimal"
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <select
        value={form.category}
        onChange={(e) => onChange({ ...form, category: e.target.value })}
        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
      >
        <option value="">Catégorie (optionnel)</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
        >
          <Check className="w-4 h-4" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>
    </div>
  );
}
