"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Plus, Calendar, Camera, ChevronRight, Check, Clock, PlayCircle } from "lucide-react";
import type { Job } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatDate, JOB_STATUS_CONFIG } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface JobListProps {
  jobs: Job[];
  businessId: string;
}

const STATUS_ICONS = {
  planned: Clock,
  in_progress: PlayCircle,
  completed: Check,
  cancelled: Check,
};

export default function JobList({ jobs, businessId }: JobListProps) {
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  const activeJobs = jobs.filter((j) => ["planned", "in_progress"].includes(j.status));
  const completedJobs = jobs.filter((j) => ["completed", "cancelled"].includes(j.status));
  const displayed = activeTab === "active" ? activeJobs : completedJobs;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Chantiers</h1>
          <p className="text-sm text-slate-500">
            {activeJobs.length} en cours · {completedJobs.length} terminé{completedJobs.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/chantiers/nouveau">
          <Button size="icon">
            <Plus className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "active" ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            En cours ({activeJobs.length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "completed" ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            Terminés ({completedJobs.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-3">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-slate-700">
                {activeTab === "active" ? "Aucun chantier en cours" : "Aucun chantier terminé"}
              </p>
              <p className="text-sm text-slate-500 mt-1">Créez un nouveau chantier</p>
            </div>
            {activeTab === "active" && (
              <Link href="/chantiers/nouveau">
                <Button>
                  <Plus className="w-4 h-4" />
                  Nouveau Chantier
                </Button>
              </Link>
            )}
          </div>
        ) : (
          displayed.map((job) => <JobCard key={job.id} job={job} />)
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const statusConfig = JOB_STATUS_CONFIG[job.status];
  const StatusIcon = STATUS_ICONS[job.status];
  const client = job.client as { full_name: string; phone: string | null } | null;

  return (
    <Link href={`/chantiers/${job.id}`}>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 active:scale-98 transition-transform">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            job.status === "in_progress" ? "bg-amber-100" :
            job.status === "completed" ? "bg-emerald-100" : "bg-blue-100"
          )}>
            <StatusIcon className={cn(
              "w-5 h-5",
              job.status === "in_progress" ? "text-amber-600" :
              job.status === "completed" ? "text-emerald-600" : "text-blue-600"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-slate-900 leading-tight">{job.title}</p>
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
            </div>
            {client && (
              <p className="text-sm text-slate-500 mt-0.5">{client.full_name}</p>
            )}
            {job.scheduled_date && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">{formatDate(job.scheduled_date)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          <Link
            href={`/chantiers/${job.id}/photos`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600"
          >
            <Camera className="w-3 h-3" />
            Photos
          </Link>
        </div>
      </div>
    </Link>
  );
}
