"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Camera, Calendar, MapPin, User, FileText, CheckCircle2, PlayCircle } from "lucide-react";
import type { Job, JobPhoto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatDate, JOB_STATUS_CONFIG, formatCurrency } from "@/lib/utils";
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
  const [job, setJob] = useState(initialJob);
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const updates: Record<string, string | null> = { status };
      if (status === "completed") updates.completed_date = new Date().toISOString();
      const { error } = await supabase.from("jobs").update(updates).eq("id", job.id);
      if (error) throw error;
      setJob((prev) => ({ ...prev, status: status as Job["status"], ...updates }));
      toast.success(status === "completed" ? "Chantier terminé !" : "Statut mis à jour");
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
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{job.address}</p>
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
    </div>
  );
}
