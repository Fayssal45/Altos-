"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Plus, Camera, X, Copy, Check, ChevronRight, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import type { Business, ProjectShowcase } from "@/lib/types";
import { cn } from "@/lib/utils";
import BeforeAfterSlider from "./BeforeAfterSlider";

interface ChantiersViewProps {
  business: Business;
  showcases: ProjectShowcase[];
}

type FormState = {
  title: string;
  description: string;
  tags: string;
};

const UPLOAD_BUCKET = "showcase-photos";

export default function ChantiersView({ business, showcases: initial }: ChantiersViewProps) {
  const supabase = createClient();

  const [showcases, setShowcases] = useState<ProjectShowcase[]>(initial);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<FormState>({ title: "", description: "", tags: "" });
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile]   = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [publishPost, setPublishPost] = useState<ProjectShowcase | null>(null);
  const [copied, setCopied]       = useState(false);

  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef  = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void
  ) => {
    if (!file) return;
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (file: File, type: "before" | "after", showcaseId: string) => {
    const ext = file.name.split(".").pop();
    const path = `${business.id}/${showcaseId}/${type}.${ext}`;
    const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Donnez un titre au chantier"); return; }
    setSaving(true);
    try {
      // Insert showcase first to get the ID
      const { data: showcase, error: insertError } = await supabase
        .from("project_showcases")
        .insert({
          business_id: business.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        })
        .select()
        .single();

      if (insertError || !showcase) throw insertError;

      let beforeUrl: string | null = null;
      let afterUrl: string | null  = null;

      if (beforeFile) beforeUrl = await uploadPhoto(beforeFile, "before", showcase.id);
      if (afterFile)  afterUrl  = await uploadPhoto(afterFile, "after", showcase.id);

      if (beforeUrl || afterUrl) {
        await supabase.from("project_showcases").update({ before_url: beforeUrl, after_url: afterUrl }).eq("id", showcase.id);
      }

      const newShowcase: ProjectShowcase = { ...showcase, before_url: beforeUrl, after_url: afterUrl };
      setShowcases((prev) => [newShowcase, ...prev]);
      setShowForm(false);
      setForm({ title: "", description: "", tags: "" });
      setBeforeFile(null); setAfterFile(null);
      setBeforePreview(null); setAfterPreview(null);
      toast.success("Chantier ajouté !");
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("project_showcases").delete().eq("id", id);
    setShowcases((prev) => prev.filter((s) => s.id !== id));
    toast.success("Supprimé");
  };

  const generatePost = (showcase: ProjectShowcase) => {
    const tags = showcase.tags?.map((t) => `#${t.replace(/\s+/g, "")}`).join(" ") ?? "";
    return `✅ Chantier terminé !\n\n${showcase.title}${showcase.description ? `\n\n${showcase.description}` : ""}\n\n${tags ? `${tags}\n\n` : ""}Vous avez un projet similaire ? Demandez votre devis gratuit 👇\n📞 ${business.phone ?? ""}\n\n#artisan${business.activity ? ` #${business.activity.replace(/\s+/g, "")}` : ""}`;
  };

  const copyPost = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Texte copié !");
  };

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/commercial" className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200 flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-slate-900 leading-tight">Mes chantiers</h1>
          <p className="text-[11px] text-slate-400">Galerie avant / après</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl active:bg-blue-700"
        >
          <Plus className="w-4 h-4" />Ajouter
        </button>
      </div>

      {/* ── Form modal ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-base font-black text-slate-900">Nouveau chantier</p>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Titre *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Rénovation salle de bain complète"
                  className="mt-1.5 w-full h-11 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm px-3 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Travaux réalisés, matériaux, durée…"
                  rows={3}
                  className="mt-1.5 w-full bg-slate-50 border-2 border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tags (séparés par des virgules)</label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="rénovation, salle de bain, carrelage"
                  className="mt-1.5 w-full h-11 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm px-3 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Photo pickers */}
              <div className="grid grid-cols-2 gap-3">
                {(["before", "after"] as const).map((type) => {
                  const preview = type === "before" ? beforePreview : afterPreview;
                  const ref = type === "before" ? beforeRef : afterRef;
                  const setFile = type === "before" ? setBeforeFile : setAfterFile;
                  const setPreview = type === "before" ? setBeforePreview : setAfterPreview;
                  const label = type === "before" ? "Photo AVANT" : "Photo APRÈS";
                  const color = type === "before" ? "bg-slate-100" : "bg-emerald-50 border-emerald-200";
                  return (
                    <div key={type}>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</label>
                      <button
                        type="button"
                        onClick={() => ref.current?.click()}
                        className={cn(
                          "mt-1.5 w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 active:opacity-80 overflow-hidden",
                          preview ? "border-transparent" : cn("border-slate-200", color)
                        )}
                      >
                        {preview
                          ? <img src={preview} alt={label} className="w-full h-full object-cover" />
                          : <>
                              <Camera className="w-6 h-6 text-slate-400" />
                              <span className="text-[10px] text-slate-400">Ajouter</span>
                            </>
                        }
                      </button>
                      <input
                        ref={ref}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null, setFile, setPreview)}
                      />
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-60"
              >
                {saving ? "Enregistrement…" : "Enregistrer le chantier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Publish post modal ────────────────────────────────────────────── */}
      {publishPost && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-black text-slate-900">Publication générée</p>
              <button onClick={() => { setPublishPost(null); setCopied(false); }}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{generatePost(publishPost)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyPost(generatePost(publishPost))}
                className={cn(
                  "flex-1 h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-colors",
                  copied ? "bg-emerald-500 text-white" : "bg-slate-900 text-white active:bg-slate-700"
                )}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copié !" : "Copier le texte"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(generatePost(publishPost))}`}
                target="_blank" rel="noopener noreferrer"
                className="h-11 px-4 bg-[#25D366] text-white font-bold rounded-xl flex items-center justify-center text-sm"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 py-5 pb-10">

        {showcases.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Aucun chantier pour l'instant</p>
              <p className="text-xs text-slate-400 mt-1">Ajoutez vos plus belles réalisations avant/après</p>
            </div>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1 bg-blue-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl active:bg-blue-700">
              <Plus className="w-4 h-4" />Ajouter un chantier
            </button>
          </div>
        )}

        {showcases.map((showcase) => (
          <div key={showcase.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Before / After images */}
            {(showcase.before_url || showcase.after_url) && (
              showcase.before_url && showcase.after_url
                ? <BeforeAfterSlider
                    beforeUrl={showcase.before_url}
                    afterUrl={showcase.after_url}
                    className="aspect-video"
                  />
                : <div className="grid grid-cols-2 divide-x divide-slate-100">
                    {(["before", "after"] as const).map((type) => {
                      const url = type === "before" ? showcase.before_url : showcase.after_url;
                      const label = type === "before" ? "AVANT" : "APRÈS";
                      return (
                        <div key={type} className="relative aspect-square bg-slate-100">
                          {url
                            ? <img src={url} alt={label} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center">
                                <Camera className="w-6 h-6 text-slate-300" />
                              </div>
                          }
                          <span className={cn(
                            "absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-full",
                            type === "before" ? "bg-black/50 text-white" : "bg-emerald-500/90 text-white"
                          )}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
            )}

            <div className="p-4 flex flex-col gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">{showcase.title}</p>
                {showcase.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{showcase.description}</p>}
              </div>
              {showcase.tags && showcase.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {showcase.tags.map((tag) => (
                    <span key={tag} className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setPublishPost(showcase)}
                  className="flex-1 h-9 bg-blue-600 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 active:bg-blue-700"
                >
                  <ChevronRight className="w-3.5 h-3.5" />Créer une publication
                </button>
                <button
                  onClick={() => handleDelete(showcase.id)}
                  className="w-9 h-9 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center active:bg-red-50 active:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
