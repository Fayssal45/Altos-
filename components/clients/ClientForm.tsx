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

// Convert empty strings to null for optional fields
function sanitize(form: Record<string, string>) {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(form)) {
    out[k] = v.trim() === "" ? null : v.trim();
  }
  return out;
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

  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: "" }));
    };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.full_name.trim()) errs.full_name = "Le nom est obligatoire";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = "Email invalide";
    }
    if (form.postal_code.trim() && !/^\d{4,6}$/.test(form.postal_code.trim())) {
      errs.postal_code = "Code postal invalide";
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Corrigez les erreurs avant de continuer");
      return;
    }

    if (!businessId) {
      toast.error("Entreprise non configurée. Allez dans Profil > Entreprise.");
      return;
    }

    setLoading(true);
    console.log("[ClientForm] submitting", { mode, businessId, form });

    try {
      // Verify session is still valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
        router.push("/login");
        return;
      }

      const payload = {
        ...sanitize(form),
        full_name: form.full_name.trim(), // required, never null
        business_id: businessId,
      };

      console.log("[ClientForm] payload:", payload);

      if (mode === "create") {
        const { data, error } = await supabase
          .from("clients")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          console.error("[ClientForm] insert error:", error);
          throw error;
        }

        console.log("[ClientForm] created:", data);
        toast.success("Client créé !");

        const params = new URLSearchParams(window.location.search);
        if (params.get("return") === "devis") {
          router.push("/devis/nouveau");
        } else {
          router.push(`/clients/${data.id}`);
        }
      } else if (client) {
        const { payload: _bid, ...updatePayload } = { ...payload, payload: null };
        const { error } = await supabase
          .from("clients")
          .update(sanitize(form))
          .eq("id", client.id);

        if (error) {
          console.error("[ClientForm] update error:", error);
          throw error;
        }

        toast.success("Client mis à jour !");
        router.push(`/clients/${client.id}`);
      }
    } catch (err: unknown) {
      const supaErr = err as { message?: string; code?: string; details?: string; hint?: string };
      const msg = supaErr?.message || String(err);
      const code = supaErr?.code || "";

      console.error("[ClientForm] full error:", { msg, code, details: supaErr?.details, hint: supaErr?.hint });

      if (code === "42501" || msg.includes("row-level security") || msg.includes("RLS")) {
        toast.error("Accès refusé. Assurez-vous que votre entreprise est bien configurée.");
      } else if (code === "23503" || msg.includes("foreign key")) {
        toast.error("L'entreprise associée est introuvable. Reconfigurer dans Profil > Entreprise.");
      } else if (code === "23505" || msg.includes("unique")) {
        toast.error("Un client avec ces informations existe déjà.");
      } else if (code === "23502" || msg.includes("not null")) {
        toast.error("Champ obligatoire manquant : " + msg);
      } else if (msg.includes("JWT") || msg.includes("token")) {
        toast.error("Session expirée. Reconnectez-vous.");
        router.push("/login");
      } else {
        toast.error("Erreur : " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h1 className="text-lg font-black text-slate-900">
            {mode === "create" ? "Nouveau Client" : "Modifier le client"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto" noValidate>
        <div className="px-4 py-4 flex flex-col gap-4">

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Identité</h2>
            <div>
              <Input
                label="Nom complet *"
                placeholder="Jean Dupont"
                icon={<User className="w-4 h-4" />}
                value={form.full_name}
                onChange={update("full_name")}
                autoComplete="name"
              />
              {errors.full_name && <p className="text-xs text-red-500 mt-1 ml-1">{errors.full_name}</p>}
            </div>
            <Input
              label="Entreprise (optionnel)"
              placeholder="Dupont SARL"
              icon={<Building2 className="w-4 h-4" />}
              value={form.company_name}
              onChange={update("company_name")}
              autoComplete="organization"
            />
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Contact</h2>
            <Input
              label="Téléphone"
              type="tel"
              placeholder="+33 6 12 34 56 78"
              icon={<Phone className="w-4 h-4" />}
              value={form.phone}
              onChange={update("phone")}
              inputMode="tel"
              autoComplete="tel"
            />
            <div>
              <Input
                label="Email"
                type="email"
                placeholder="jean@example.com"
                icon={<Mail className="w-4 h-4" />}
                value={form.email}
                onChange={update("email")}
                inputMode="email"
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1 ml-1">{errors.email}</p>}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Adresse</h2>
            <Input
              label="Adresse"
              placeholder="12 rue de la Paix"
              icon={<MapPin className="w-4 h-4" />}
              value={form.address}
              onChange={update("address")}
              autoComplete="street-address"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Input
                  label="Code postal"
                  placeholder="75001"
                  value={form.postal_code}
                  onChange={update("postal_code")}
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
                {errors.postal_code && <p className="text-[10px] text-red-500 mt-0.5">{errors.postal_code}</p>}
              </div>
              <div className="col-span-2">
                <Input
                  label="Ville"
                  placeholder="Paris"
                  value={form.city}
                  onChange={update("city")}
                  autoComplete="address-level2"
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
              placeholder="Informations utiles sur ce client…"
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
