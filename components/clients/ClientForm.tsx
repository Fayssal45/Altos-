"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Phone, Mail, MapPin, Building2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Client } from "@/lib/types";

interface ClientFormProps {
  businessId: string;
  mode: "create" | "edit";
  client?: Client;
}

export default function ClientForm({ businessId, mode, client }: ClientFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: client?.full_name || "",
    company_name: client?.company_name || "",
    phone: client?.phone || "",
    email: client?.email || "",
    address: client?.address || "",
    city: client?.city || "",
    postal_code: client?.postal_code || "",
    notes: client?.notes || "",
  });

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setLoading(true);

    try {
      if (mode === "create") {
        const { data, error } = await supabase
          .from("clients")
          .insert({ ...form, business_id: businessId })
          .select()
          .single();
        if (error) throw error;
        toast.success("Client créé !");

        // Retour contexte : si on vient de la création de devis
        const params = new URLSearchParams(window.location.search);
        if (params.get("return") === "devis") {
          router.push("/devis/nouveau");
        } else {
          router.push(`/clients/${data.id}`);
        }
      } else if (client) {
        const { error } = await supabase
          .from("clients")
          .update(form)
          .eq("id", client.id);
        if (error) throw error;
        toast.success("Client mis à jour !");
        router.push(`/clients/${client.id}`);
      }
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h1 className="text-lg font-black text-slate-900">
            {mode === "create" ? "Nouveau Client" : "Modifier le client"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 flex flex-col gap-4">

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Identité</h2>
            <Input
              label="Nom complet *"
              placeholder="Jean Dupont"
              icon={<User className="w-4 h-4" />}
              value={form.full_name}
              onChange={update("full_name")}
              required
            />
            <Input
              label="Entreprise"
              placeholder="Dupont SARL"
              icon={<Building2 className="w-4 h-4" />}
              value={form.company_name}
              onChange={update("company_name")}
            />
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Contact</h2>
            <Input
              label="Téléphone"
              type="tel"
              placeholder="06 12 34 56 78"
              icon={<Phone className="w-4 h-4" />}
              value={form.phone}
              onChange={update("phone")}
              inputMode="tel"
            />
            <Input
              label="Email"
              type="email"
              placeholder="jean@example.fr"
              icon={<Mail className="w-4 h-4" />}
              value={form.email}
              onChange={update("email")}
              inputMode="email"
            />
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Adresse</h2>
            <Input
              label="Adresse"
              placeholder="12 rue de la Paix"
              icon={<MapPin className="w-4 h-4" />}
              value={form.address}
              onChange={update("address")}
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Input
                  label="Code postal"
                  placeholder="75001"
                  value={form.postal_code}
                  onChange={update("postal_code")}
                  inputMode="numeric"
                />
              </div>
              <div className="col-span-2">
                <Input
                  label="Ville"
                  placeholder="Paris"
                  value={form.city}
                  onChange={update("city")}
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Notes internes
            </label>
            <textarea
              value={form.notes}
              onChange={update("notes")}
              placeholder="Informations utiles sur ce client..."
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
          </section>

          <Button type="submit" size="xl" loading={loading} className="w-full">
            {mode === "create" ? "Créer le client" : "Enregistrer"}
          </Button>

          <div className="h-6" />
        </div>
      </form>
    </div>
  );
}
