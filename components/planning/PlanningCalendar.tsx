"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  ChevronLeft, ChevronRight, Plus, X,
  Briefcase, Bell, MapPin, Clock, ArrowRight,
  Calendar, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job, Reminder, Client } from "@/lib/types";

type CalendarJob = Pick<Job, "id" | "title" | "status" | "scheduled_date" | "address"> & {
  client: { full_name: string } | null;
};

type CalendarReminder = Pick<Reminder, "id" | "type" | "scheduled_at" | "message" | "status"> & {
  client: { full_name: string } | null;
};

interface PlanningCalendarProps {
  jobs: CalendarJob[];
  reminders: CalendarReminder[];
  clients: Client[];
  businessId: string;
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const JOB_STATUS_COLOR: Record<string, string> = {
  planned: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-300",
};

const JOB_STATUS_LABEL: Record<string, string> = {
  planned: "Planifié",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate()
    && a.getMonth() === b.getMonth()
    && a.getFullYear() === b.getFullYear();
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function PlanningCalendar({ jobs, reminders, clients, businessId }: PlanningCalendarProps) {
  const router = useRouter();
  const supabase = createClient();

  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addType, setAddType] = useState<"visit" | "reminder" | null>(null);
  const [addForm, setAddForm] = useState({ title: "", clientId: "", time: "09:00", notes: "" });
  const [saving, setSaving] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-based week: 0=Mon … 6=Sun
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    // Pad to full rows
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  // Index events by day key
  const jobsByDay = useMemo(() => {
    const map: Record<string, CalendarJob[]> = {};
    for (const job of jobs) {
      if (!job.scheduled_date) continue;
      const d = new Date(job.scheduled_date);
      const k = toDateKey(d);
      if (!map[k]) map[k] = [];
      map[k].push(job);
    }
    return map;
  }, [jobs]);

  const remindersByDay = useMemo(() => {
    const map: Record<string, CalendarReminder[]> = {};
    for (const r of reminders) {
      if (!r.scheduled_at) continue;
      const d = new Date(r.scheduled_at);
      const k = toDateKey(d);
      if (!map[k]) map[k] = [];
      map[k].push(r);
    }
    return map;
  }, [reminders]);

  const selectedJobs = selectedDay ? (jobsByDay[toDateKey(selectedDay)] || []) : [];
  const selectedReminders = selectedDay ? (remindersByDay[toDateKey(selectedDay)] || []) : [];

  const prevMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), []);
  const nextMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), []);

  const handleDayClick = (day: Date) => {
    setSelectedDay(prev => (prev && isSameDay(prev, day) ? null : day));
    setShowAddSheet(false);
    setAddType(null);
  };

  const handleAddEvent = async () => {
    if (!selectedDay || !addType) return;
    setSaving(true);
    try {
      const dateTime = new Date(
        selectedDay.getFullYear(),
        selectedDay.getMonth(),
        selectedDay.getDate(),
        parseInt(addForm.time.split(":")[0]),
        parseInt(addForm.time.split(":")[1])
      ).toISOString();

      if (addType === "visit") {
        const title = addForm.title || "Visite client";
        const { data, error } = await supabase
          .from("jobs")
          .insert({
            business_id: businessId,
            client_id: addForm.clientId || null,
            title,
            status: "planned",
            scheduled_date: dateTime,
            notes: addForm.notes || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Visite planifiée !");
        router.refresh();
        setShowAddSheet(false);
        setAddType(null);
        setAddForm({ title: "", clientId: "", time: "09:00", notes: "" });
        if (data?.id) router.push(`/chantiers/${data.id}`);
      } else {
        const { error } = await supabase
          .from("reminders")
          .insert({
            business_id: businessId,
            client_id: addForm.clientId || null,
            type: "custom",
            status: "pending",
            scheduled_at: dateTime,
            message: addForm.notes || addForm.title || "Rappel",
          });
        if (error) throw error;
        toast.success("Rappel ajouté !");
        router.refresh();
        setShowAddSheet(false);
        setAddType(null);
        setAddForm({ title: "", clientId: "", time: "09:00", notes: "" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const convertToEstimate = (job: CalendarJob) => {
    router.push(`/devis/nouveau?jobId=${job.id}&clientId=${job.client ? "" : ""}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-black text-slate-900">Planning</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-bold text-slate-700 min-w-[110px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Calendar grid */}
        <div className="px-4 pt-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAYS.map(d => (
                <div key={d} className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="aspect-[1/1.1] border-r border-b border-slate-50 last:border-r-0" />;

                const key = toDateKey(day);
                const dayJobs = jobsByDay[key] || [];
                const dayReminders = remindersByDay[key] || [];
                const isToday = isSameDay(day, today);
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                const hasEvents = dayJobs.length > 0 || dayReminders.length > 0;

                return (
                  <button
                    key={key}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "aspect-[1/1.1] flex flex-col items-center pt-1.5 pb-1 px-0.5 border-r border-b border-slate-50 last:border-r-0 transition-colors",
                      isSelected ? "bg-violet-50" : "active:bg-slate-50"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-blue-600 text-white" : isSelected ? "bg-violet-600 text-white" : "text-slate-700"
                    )}>
                      {day.getDate()}
                    </span>
                    {hasEvents && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {dayJobs.slice(0, 2).map(j => (
                          <span key={j.id} className={cn("w-1.5 h-1.5 rounded-full", JOB_STATUS_COLOR[j.status])} />
                        ))}
                        {dayReminders.slice(0, 1).map(r => (
                          <span key={r.id} className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        ))}
                        {(dayJobs.length + dayReminders.length) > 3 && (
                          <span className="text-[8px] text-slate-400 font-bold">+{dayJobs.length + dayReminders.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 pt-2 flex gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] text-slate-400">Planifié</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] text-slate-400">En cours</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-slate-400">Terminé</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-[10px] text-slate-400">Rappel</span>
          </div>
        </div>

        {/* Selected day panel */}
        {selectedDay && (
          <div className="px-4 pt-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900">
                  {selectedDay.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAddSheet(true); setAddType("visit"); }}
                    className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Visite
                  </button>
                  <button
                    onClick={() => { setShowAddSheet(true); setAddType("reminder"); }}
                    className="flex items-center gap-1.5 bg-orange-50 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-xl"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Rappel
                  </button>
                </div>
              </div>

              {/* Add event form */}
              {showAddSheet && addType && (
                <div className="px-4 py-4 border-b border-slate-50 bg-slate-50/50 animate-slide-up">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-700">
                      {addType === "visit" ? "Planifier une visite" : "Ajouter un rappel"}
                    </p>
                    <button onClick={() => { setShowAddSheet(false); setAddType(null); }}>
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <input
                      type="text"
                      placeholder={addType === "visit" ? "Titre (ex: Visite diagnostic)" : "Message du rappel"}
                      value={addForm.title}
                      onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={addForm.clientId}
                        onChange={e => setAddForm(f => ({ ...f, clientId: e.target.value }))}
                        className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Client (optionnel)</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.full_name}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={addForm.time}
                        onChange={e => setAddForm(f => ({ ...f, time: e.target.value }))}
                        className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <textarea
                      placeholder="Notes..."
                      value={addForm.notes}
                      onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                    <button
                      onClick={handleAddEvent}
                      disabled={saving}
                      className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
                    >
                      {saving ? "Enregistrement…" : addType === "visit" ? "Planifier la visite" : "Ajouter le rappel"}
                    </button>
                  </div>
                </div>
              )}

              {/* Events list */}
              {selectedJobs.length === 0 && selectedReminders.length === 0 && !showAddSheet && (
                <div className="px-4 py-8 text-center">
                  <p className="text-slate-400 text-sm">Aucun événement ce jour</p>
                  <p className="text-slate-300 text-xs mt-1">Appuyez sur + Visite ou + Rappel pour en ajouter</p>
                </div>
              )}

              {selectedJobs.map((job, i) => (
                <div
                  key={job.id}
                  className={cn("px-4 py-3 flex items-start gap-3", i < selectedJobs.length - 1 || selectedReminders.length > 0 ? "border-b border-slate-50" : "")}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                    job.status === "planned" ? "bg-blue-100" : job.status === "in_progress" ? "bg-amber-100" : "bg-emerald-100"
                  )}>
                    <Briefcase className={cn("w-4 h-4", job.status === "planned" ? "text-blue-600" : job.status === "in_progress" ? "text-amber-600" : "text-emerald-600")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{job.title}</p>
                    {job.client && (
                      <p className="text-xs text-slate-500">{job.client.full_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {job.scheduled_date && (
                        <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          {formatTime(job.scheduled_date)}
                        </span>
                      )}
                      {job.address && (
                        <span className="flex items-center gap-0.5 text-[11px] text-slate-400 truncate">
                          <MapPin className="w-3 h-3" />
                          {job.address}
                        </span>
                      )}
                    </div>
                    <span className={cn("inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full mt-1", JOB_STATUS_COLOR[job.status].replace("bg-", "bg-").replace("500", "100"), "text-" + (job.status === "planned" ? "blue" : job.status === "in_progress" ? "amber" : "emerald") + "-700")}>
                      {JOB_STATUS_LABEL[job.status]}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => router.push(`/chantiers/${job.id}`)}
                      className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button
                      onClick={() => convertToEstimate(job)}
                      className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"
                      title="Créer un devis"
                    >
                      <Zap className="w-3.5 h-3.5 text-blue-600" />
                    </button>
                  </div>
                </div>
              ))}

              {selectedReminders.map((r, i) => (
                <div
                  key={r.id}
                  className={cn("px-4 py-3 flex items-start gap-3", i < selectedReminders.length - 1 ? "border-b border-slate-50" : "")}
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bell className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{r.message || "Rappel"}</p>
                    {r.client && <p className="text-xs text-slate-500">{r.client.full_name}</p>}
                    {r.scheduled_at && (
                      <span className="flex items-center gap-0.5 text-[11px] text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatTime(r.scheduled_at)}
                      </span>
                    )}
                    <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 bg-orange-100 text-orange-700">
                      Rappel
                    </span>
                  </div>
                  <button
                    onClick={() => router.push(`/relances`)}
                    className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No events this month */}
        {!selectedDay && jobs.length === 0 && reminders.length === 0 && (
          <div className="px-4 pt-6 text-center">
            <p className="text-slate-400 text-sm">Aucun événement ce mois-ci</p>
            <p className="text-slate-300 text-xs mt-1">Appuyez sur un jour pour planifier une visite</p>
          </div>
        )}

        {/* Upcoming events list */}
        {!selectedDay && (jobs.length > 0 || reminders.length > 0) && (
          <div className="px-4 pt-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Prochains événements
            </h2>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {[
                ...jobs
                  .filter(j => j.scheduled_date && new Date(j.scheduled_date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
                  .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())
                  .slice(0, 8)
                  .map(j => ({ type: "job" as const, date: j.scheduled_date!, item: j })),
                ...reminders
                  .filter(r => r.scheduled_at && new Date(r.scheduled_at) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
                  .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
                  .slice(0, 4)
                  .map(r => ({ type: "reminder" as const, date: r.scheduled_at!, item: r })),
              ]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 10)
                .map((event, i, arr) => {
                  const d = new Date(event.date);
                  const dateStr = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

                  if (event.type === "job") {
                    const job = event.item as CalendarJob;
                    return (
                      <button
                        key={job.id}
                        onClick={() => {
                          setSelectedDay(d);
                          setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
                        }}
                        className={cn("w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50", i < arr.length - 1 ? "border-b border-slate-50" : "")}
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", JOB_STATUS_COLOR[job.status].replace("500", "100"))}>
                          <Briefcase className={cn("w-4 h-4", "text-" + (job.status === "planned" ? "blue" : job.status === "in_progress" ? "amber" : "emerald") + "-600")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{job.title}</p>
                          <p className="text-xs text-slate-400">{dateStr} · {formatTime(event.date)}{job.client ? ` · ${job.client.full_name}` : ""}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </button>
                    );
                  } else {
                    const r = event.item as CalendarReminder;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedDay(d);
                          setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
                        }}
                        className={cn("w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50", i < arr.length - 1 ? "border-b border-slate-50" : "")}
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Bell className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{r.message || "Rappel"}</p>
                          <p className="text-xs text-slate-400">{dateStr} · {formatTime(event.date)}{r.client ? ` · ${r.client.full_name}` : ""}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </button>
                    );
                  }
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
