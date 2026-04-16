"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Building2, Phone, Mail, MapPin, CreditCard, Upload, Check } from "lucide-react";
import toast from "react-hot-toast";
import type { Business } from "@/lib/types";

interface BusinessProfileFormProps {
  business: Business | null;
  userId: string;
}

const ACTIVITIES = [
  "Électricien",
  "Plombier",
  "Chauffagiste",
  "Paysagiste",
  "Maçon",
  "Carreleur",
  "Peintre",
  "Menuisier",
  "Couvreur",
  "Multi-services",
  "Autre",
];

const VAT_REGIMES = [
  { value: "normal", label: "Assujetti TVA (régime normal)" },
  { value: "micro", label: "Micro-entreprise (franchise de TVA)" },
  { value: "none", label: "Non assujetti à la TVA" },
];

export default function BusinessProfileForm({ business, userId }: BusinessProfileFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: business?.name || "",
    activity: business?.activity || "",
    phone: business?.phone || "",
    email: business?.email || "",
    address: business?.address || "",
    vat_number: business?.vat_number || "",
    siret: business?.siret || "",
    iban: business?.iban || "",
    payment_terms: business?.payment_terms || "30 jours",
    vat_regime: business?.vat_regime || "normal",
    logo_url: business?.logo_url || "",
  });

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const filename = `${userId}/logo-${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("logos").upload(filename, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(filename);
      setForm((prev) => ({ ...prev, logo_url: publicUrl }));
      toast.success("Logo uploadé !");
    } catch {
      toast.error("Erreur lors de l'upload du logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Le nom de l'entreprise est obligatoire");
      return;
    }
    setSaving(true);

    try {
      if (business) {
        const { error } = await supabase
          .from("businesses")
          .update({ ...form })
          .eq("id", business.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("businesses")
          .insert({ ...form, owner_id: userId });
        if (error) throw error;
      }

      toast.success("Entreprise enregistrée !");
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h1 className="text-lg font-black text-slate-900">Mon Entreprise</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 flex flex-col gap-4">

          {/* Logo */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Logo</h2>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-7 h-7 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <input ref={logoInputRef} type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  loading={logoUploading}
                >
                  <Upload className="w-4 h-4" />
                  {form.logo_url ? "Changer" : "Uploader"} le logo
                </Button>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG · Visible sur vos devis</p>
              </div>
            </div>
          </section>

          {/* Identité */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Identité</h2>
            <Input
              label="Nom de l'entreprise *"
              placeholder="DUPONT Électricité"
              icon={<Building2 className="w-4 h-4" />}
              value={form.name}
              onChange={update("name")}
              required
            />
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Activité</label>
              <select
                value={form.activity}
                onChange={update("activity")}
                className="w-full h-12 bg-white border-2 border-slate-200 rounded-xl px-4 text-base text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">Choisir une activité…</option>
                {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Contact</h2>
            <Input
              label="Téléphone"
              type="tel"
              placeholder="06 12 34 56 78"
              icon={<Phone className="w-4 h-4" />}
              value={form.phone}
              onChange={update("phone")}
            />
            <Input
              label="Email"
              type="email"
              placeholder="contact@dupont-elec.fr"
              icon={<Mail className="w-4 h-4" />}
              value={form.email}
              onChange={update("email")}
            />
            <Input
              label="Adresse"
              placeholder="12 rue de la Paix, 75001 Paris"
              icon={<MapPin className="w-4 h-4" />}
              value={form.address}
              onChange={update("address")}
            />
          </section>

          {/* Fiscalité */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Informations fiscales</h2>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Régime TVA</label>
              <select
                value={form.vat_regime}
                onChange={update("vat_regime")}
                className="w-full h-12 bg-white border-2 border-slate-200 rounded-xl px-4 text-base text-slate-900 focus:outline-none focus:border-blue-500"
              >
                {VAT_REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <Input
              label="N° SIRET"
              placeholder="123 456 789 00012"
              value={form.siret}
              onChange={update("siret")}
            />
            <Input
              label="N° TVA intracommunautaire"
              placeholder="FR12345678901"
              value={form.vat_number}
              onChange={update("vat_number")}
            />
          </section>

          {/* Paiement */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Paiement</h2>
            <Input
              label="IBAN"
              placeholder="FR76 3000 6000 0112 3456 7890 189"
              icon={<CreditCard className="w-4 h-4" />}
              value={form.iban}
              onChange={update("iban")}
            />
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Conditions de règlement</label>
              <select
                value={form.payment_terms}
                onChange={update("payment_terms")}
                className="w-full h-12 bg-white border-2 border-slate-200 rounded-xl px-4 text-base text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="À réception">À réception</option>
                <option value="15 jours">15 jours</option>
                <option value="30 jours">30 jours</option>
                <option value="45 jours">45 jours</option>
                <option value="60 jours">60 jours</option>
                <option value="Acompte 30%">Acompte 30% + solde à la livraison</option>
                <option value="Acompte 50%">Acompte 50% + solde à la livraison</option>
              </select>
            </div>
          </section>

          <Button type="submit" size="xl" loading={saving} className="w-full">
            <Check className="w-5 h-5" />
            Enregistrer
          </Button>

          <div className="h-6" />
        </div>
      </form>
    </div>
  );
}
