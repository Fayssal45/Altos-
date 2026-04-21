"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Camera, Calendar, MapPin, User, FileText, CheckCircle2, PlayCircle, Clock, Navigation, Star, X, MessageCircle } from "lucide-react";
import type { Job, JobPhoto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatDate, JOB_STATUS_CONFIG, formatCurrency, formatDuration } from "@/lib/utils";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type FullJob = Job & {
  client: { full_name: string; phone: string | null; email: string | null } | null;
  estimate: { number: string | null; title: string | null; total_amount_ht: number; vat_rate: number } | null;
};

interface JobDetailProps {
  job: FullJob;
  photos: JobPhoto[];
}

export default function JobDetail({ job: initialJob, photos }: JobDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const [job, setJob]           = useState(initialJob);
  const [updating, setUpdating] = useState(false);
  const [showDoneSheet, setShowDoneSheet] = useState(false);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const updates: Record<string, string | null> = { status };
      if (status === "completed") updates.completed_date = new Date().toISOString();
      const { error } = await supabase.from("jobs").update(updates).eq("id", job.id);
      if (error) throw error;
      setJob((prev) => ({ ...prev, status: status as Job["status"], ...updates }));
      if (status === "completed") {
        setShowDoneSheet(true);
      } else {
        toast.success("Statut mis à jour");
      }
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setUpdating(false);
    }
  };

  const statusConfig = JOB_STATUS_CONFIG[job.status];
  const estimateTTC = job.estimate
    ? (job.estimate.total_amount_ht || 0) * (1 + (job.estimate.vat_rate || 20) / 100)
    : 0;

  const beforePhotos = photos.filter((p) => p.type === "before");
  const afterPhotos = photos.filter((p) => p.type === "after");

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-slate-900 leading-tight truncate">{job.title}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {/* Infos */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
          {job.client && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{job.client.full_name}</p>
                {job.client.phone && <p className="text-xs text-slate-400">{job.client.phone}</p>}
              </div>
            </div>
          )}
          {job.scheduled_date && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{formatDate(job.scheduled_date)}</p>
            </div>
          )}
          {job.address && (
            <a
              href={`https://waze.com/ul?q=${encodeURIComponent(job.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 active:opacity-70"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Navigation className="w-4 h-4 text-sky-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{job.address}</p>
                <p className="text-xs text-sky-500">Ouvrir dans Waze</p>
              </div>
            </a>
          )}
          {job.estimated_hours && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatDuration(job.estimated_hours)}</p>
                <p className="text-xs text-slate-400">Durée estimée</p>
              </div>
            </div>
          )}
          {job.estimate && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{job.estimate.number}</p>
                <p className="text-xs text-slate-400">{formatCurrency(estimateTTC)} TTC</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions statut */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <div className="flex gap-3">
            {job.status === "planned" && (
              <Button
                variant="warning"
                size="lg"
                className="flex-1"
                loading={updating}
                onClick={() => updateStatus("in_progress")}
              >
                <PlayCircle className="w-5 h-5" />
                Démarrer
              </Button>
            )}
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              loading={updating}
              onClick={() => updateStatus("completed")}
            >
              <CheckCircle2 className="w-5 h-5" />
              Terminer
            </Button>
          </div>
        )}

        {/* Photos */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Photos ({photos.length})
            </h2>
            <Link href={`/chantiers/${job.id}/photos`}>
              <Button size="sm" variant="outline">
                <Camera className="w-4 h-4" />
                Gérer
              </Button>
            </Link>
          </div>

          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 6).map((photo) => (
                <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              {photos.length > 6 && (
                <Link href={`/chantiers/${job.id}/photos`}>
                  <div className="aspect-square rounded-xl bg-slate-200 flex items-center justify-center">
                    <span className="text-slate-600 font-bold text-sm">+{photos.length - 6}</span>
                  </div>
                </Link>
              )}
            </div>
          ) : (
            <Link href={`/chantiers/${job.id}/photos`}>
              <div className="flex flex-col items-center justify-center gap-2 bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6 text-slate-400">
                <Camera className="w-8 h-8" />
                <p className="text-sm font-medium">Ajouter des photos avant/après</p>
              </div>
            </Link>
          )}
        </div>

        {job.notes && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-sm font-bold text-slate-700 mb-1">Notes</p>
            <p className="text-sm text-slate-600 whitespace-pre-line">{job.notes}</p>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* ── Post-completion sheet ─────────────────────────────────────────── */}
      {showDoneSheet && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowDoneSheet(false)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-white rounded-t-3xl shadow-2xl animate-slide-up">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3" />
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div>
                <p className="text-base font-black text-slate-900">Intervention terminée ✓</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Que souhaitez-vous faire ensuite ?</p>
              </div>
              <button onClick={() => setShowDoneSheet(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex flex-col gap-2 px-5 pb-2 pt-3">
              {/* Demander un avis */}
              <Link
                href="/commercial/reputation"
                onClick={() => setShowDoneSheet(false)}
                className="flex items-center gap-4 bg-amber-50 rounded-2xl px-4 py-3.5 active:bg-amber-100"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Demander un avis Google</p>
                  <p className="text-xs text-slate-500 mt-0.5">Envoyez une demande d&apos;avis à {job.client?.full_name ?? "ce client"}</p>
                </div>
              </Link>

              {/* Créer avant/après */}
              <Link
                href="/commercial/chantiers"
                onClick={() => setShowDoneSheet(false)}
                className="flex items-center gap-4 bg-pink-50 rounded-2xl px-4 py-3.5 active:bg-pink-100"
              >
                <div className="w-10 h-10 rounded-xl bg-pink-500 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Créer un avant / après</p>
                  <p className="text-xs text-slate-500 mt-0.5">Ajoutez ce chantier à votre galerie</p>
                </div>
              </Link>

              {/* Relancer */}
              <Link
                href="/commercial/parrainage"
                onClick={() => setShowDoneSheet(false)}
                className="flex items-center gap-4 bg-violet-50 rounded-2xl px-4 py-3.5 active:bg-violet-100"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Demander une recommandation</p>
                  <p className="text-xs text-slate-500 mt-0.5">Invitez ce client à parler de vous</p>
                </div>
              </Link>
            </div>
            <div className="px-5 pb-5 pt-2">
              <button
                onClick={() => setShowDoneSheet(false)}
                className="w-full h-11 bg-slate-100 rounded-xl font-semibold text-sm text-slate-500 active:bg-slate-200"
              >
                Pas maintenant
              </button>
            </div>
            <div className="pb-safe h-2" />
          </div>
        </>
      )}
    </div>
  );
}
