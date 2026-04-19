"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Camera, ArrowLeft, Upload, Trash2, ImageIcon } from "lucide-react";
import type { Job, JobPhoto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
// imageCompression loaded on demand (see upload handler)

interface JobPhotosProps {
  job: Job & { client: { full_name: string } | null };
  photos: JobPhoto[];
}

type PhotoType = "before" | "after" | "progress";

const TYPE_LABELS: Record<PhotoType, string> = {
  before: "Avant",
  after: "Après",
  progress: "En cours",
};

const TYPE_COLORS: Record<PhotoType, string> = {
  before: "bg-orange-100 text-orange-700",
  after: "bg-emerald-100 text-emerald-700",
  progress: "bg-blue-100 text-blue-700",
};

export default function JobPhotos({ job, photos: initialPhotos }: JobPhotosProps) {
  const router = useRouter();
  const supabase = createClient();
  const [photos, setPhotos] = useState<JobPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [activeType, setActiveType] = useState<PhotoType>("before");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    const toastId = toast.loading(`Upload de ${files.length} photo${files.length > 1 ? "s" : ""}...`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      for (const file of files) {
        // Compression côté client pour économiser la data
        const imageCompression = (await import("browser-image-compression")).default;
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        const filename = `${user.id}/${job.id}/${activeType}-${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("job-photos")
          .upload(filename, compressed, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("job-photos")
          .getPublicUrl(filename);

        const { data: newPhoto, error: dbError } = await supabase
          .from("job_photos")
          .insert({
            job_id: job.id,
            url: publicUrl,
            storage_path: filename,
            type: activeType,
          })
          .select()
          .single();

        if (dbError) throw dbError;
        setPhotos((prev) => [...prev, newPhoto]);
      }

      toast.success("Photos uploadées !", { id: toastId });
    } catch (err) {
      toast.error("Erreur d'upload", { id: toastId });
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deletePhoto = async (photo: JobPhoto) => {
    if (!confirm("Supprimer cette photo ?")) return;

    try {
      if (photo.storage_path) {
        await supabase.storage.from("job-photos").remove([photo.storage_path]);
      }
      await supabase.from("job_photos").delete().eq("id", photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      toast.success("Photo supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const photosByType = {
    before: photos.filter((p) => p.type === "before"),
    progress: photos.filter((p) => p.type === "progress"),
    after: photos.filter((p) => p.type === "after"),
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-slate-900 leading-tight">Photos</h1>
            <p className="text-xs text-slate-400">{job.title}</p>
          </div>
          <span className="text-sm text-slate-400">{photos.length} photo{photos.length > 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Type selector + upload */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-sm font-bold text-slate-700 mb-3">Type de photo</p>
          <div className="flex gap-2 mb-4">
            {(Object.keys(TYPE_LABELS) as PhotoType[]).map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeType === type
                    ? TYPE_COLORS[type]
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {/* Input file caché */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            className="w-full"
          >
            <Camera className="w-5 h-5" />
            {uploading ? "Upload en cours…" : `Prendre / Importer (${TYPE_LABELS[activeType]})`}
          </Button>
        </div>

        {/* Grilles de photos par type */}
        {(Object.keys(photosByType) as PhotoType[]).map((type) => {
          const typedPhotos = photosByType[type];
          if (typedPhotos.length === 0) return null;

          return (
            <div key={type}>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                {TYPE_LABELS[type]} ({typedPhotos.length})
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {typedPhotos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group">
                    <img
                      src={photo.url}
                      alt={TYPE_LABELS[photo.type as PhotoType]}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors" />
                    <button
                      onClick={() => deletePhoto(photo)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </button>
                    <div className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_COLORS[photo.type as PhotoType]}`}>
                      {TYPE_LABELS[photo.type as PhotoType]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {photos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">Aucune photo pour cette intervention</p>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
