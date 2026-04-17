"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, FileText, Calendar, MapPin, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface JobFormProps {
  businessId: string;
  clients: { id: string; full_name: string; company_name: string | null }[];
  estimates: { id: string; number: string | null; title: string | null; status: string }[];
}

// Durées prédéfinies (en heures)
const DURATION_PRESETS = [
  { label: "1 h",  hours: 1 },
  { label: "2 h",  hours: 2 },
  { label: "3 h",  hours: 3 },
  { label: "½ j",  hours: 4 },
  { label: "1 j",  hours: 8 },
  { label: "2 j",  hours: 16 },
  { label: "3 j",  hours: 24 },
  { label: "1 sem", hours: 40 },
];

export default function JobForm({ businessId, clients, estimates }: JobFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    client_id: "",
    estimate_id: "",
    scheduled_date: "",
    address: "",
    description: "",
    notes: "",
  });
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
  const [customHours, setCustomHours] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const update = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handlePreset = (hours: number) => {
    setEstimatedHours(hours);
    setShowCustom(false);
    setCustomHours("");
  };

  const handleCustom = (val: string) => {
    setCustomHours(val);
    const h = parseFloat(val);
    setEstimatedHours(h > 0 ? h : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Titre obligatoire"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          business_id: businessId,
          title: form.title,
          client_id: form.client_id || null,
          estimate_id: form.estimate_id || null,
          scheduled_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : null,
          address: form.address || null,
          description: form.description || null,
          notes: form.notes || null,
          estimated_hours: estimatedHours,
          status: "planned",
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Intervention créée !");
      router.push(`/chantiers/${data.id}`);
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h1 className="text-lg font-black text-slate-900">Nouvelle Intervention</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 flex flex-col gap-4">

          {/* Infos de base */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <Input
              label="Titre de l'intervention *"
              placeholder="Installation VMC salle de bain"
              value={form.title}
              onChange={update("title")}
              required
            />
            <Input
              label="Adresse de l'intervention"
              placeholder="Rue des Artisans 12, 1000 Bruxelles"
              icon={<MapPin className="w-4 h-4" />}
              value={form.address}
              onChange={update("address")}
            />
          </section>

          {/* Client + Devis */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                <User className="w-4 h-4 inline mr-1.5" />Client
              </label>
              <select
                value={form.client_id}
                onChange={update("client_id")}
                className="w-full h-12 bg-white border-2 border-slate-200 rounded-xl px-4 text-base text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">Aucun client sélectionné</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}{c.company_name ? ` (${c.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {estimates.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  <FileText className="w-4 h-4 inline mr-1.5" />Lier à un devis
                </label>
                <select
                  value={form.estimate_id}
                  onChange={update("estimate_id")}
                  className="w-full h-12 bg-white border-2 border-slate-200 rounded-xl px-4 text-base text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Aucun devis lié</option>
                  {estimates.map((e) => (
                    <option key={e.id} value={e.id}>{e.number} – {e.title || "Sans titre"}</option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* Date + Durée */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <Input
              label="Date planifiée"
              type="datetime-local"
              icon={<Calendar className="w-4 h-4" />}
              value={form.scheduled_date}
              onChange={update("scheduled_date")}
            />

            {/* Durée estimée */}
            <div>
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-2">
                <Clock className="w-4 h-4" />
                Durée estimée
                {estimatedHours && (
                  <span className="ml-auto text-xs font-semibold text-blue-600">
                    {estimatedHours < 8
                      ? `${estimatedHours} heure${estimatedHours > 1 ? "s" : ""}`
                      : estimatedHours % 8 === 0
                        ? `${estimatedHours / 8} jour${estimatedHours / 8 > 1 ? "s" : ""}`
                        : `${Math.floor(estimatedHours / 8)}j ${estimatedHours % 8}h`}
                  </span>
                )}
              </label>

              {/* Presets */}
              <div className="flex flex-wrap gap-2 mb-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => handlePreset(p.hours)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm font-semibold border transition-all",
                      estimatedHours === p.hours
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 active:bg-slate-50"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setShowCustom(!showCustom); setEstimatedHours(null); setCustomHours(""); }}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm font-semibold border transition-all",
                    showCustom ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  Autre
                </button>
              </div>

              {/* Saisie libre en heures */}
              {showCustom && (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={customHours}
                    onChange={(e) => handleCustom(e.target.value)}
                    placeholder="Ex : 6"
                    min="0.5"
                    step="0.5"
                    inputMode="decimal"
                    className="w-28 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-sm text-slate-500">heures</span>
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={update("notes")}
              placeholder="Informations utiles pour l'intervention…"
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
          </section>

          <Button type="submit" size="xl" loading={loading} className="w-full">
            Créer l'intervention
          </Button>

          <div className="h-6" />
        </div>
      </form>
    </div>
  );
}
