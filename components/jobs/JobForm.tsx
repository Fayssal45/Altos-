"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, FileText, Calendar, MapPin } from "lucide-react";
import toast from "react-hot-toast";

interface JobFormProps {
  businessId: string;
  clients: { id: string; full_name: string; company_name: string | null }[];
  estimates: { id: string; number: string | null; title: string | null; status: string }[];
}

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

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
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
          status: "planned",
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Chantier créé !");
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
          <h1 className="text-lg font-black text-slate-900">Nouveau Chantier</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 flex flex-col gap-4">

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <Input
              label="Titre du chantier *"
              placeholder="Installation VMC salle de bain"
              value={form.title}
              onChange={update("title")}
              required
            />
            <Input
              label="Adresse du chantier"
              placeholder="12 rue de la Paix, Paris"
              icon={<MapPin className="w-4 h-4" />}
              value={form.address}
              onChange={update("address")}
            />
          </section>

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
                  <option key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` (${c.company_name})` : ""}</option>
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

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <Input
              label="Date planifiée"
              type="datetime-local"
              icon={<Calendar className="w-4 h-4" />}
              value={form.scheduled_date}
              onChange={update("scheduled_date")}
            />
          </section>

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
            Créer le chantier
          </Button>

          <div className="h-6" />
        </div>
      </form>
    </div>
  );
}
