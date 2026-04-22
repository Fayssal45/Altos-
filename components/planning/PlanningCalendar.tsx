"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  ChevronLeft, ChevronRight, Plus, X,
  Wrench, Bell, MapPin, Phone,
  Search, Zap, AlertTriangle, Calendar, FileText,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Job, Reminder, Client } from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

type CalView = "day" | "week" | "month";

type CalendarJob = Pick<Job, "id" | "title" | "status" | "scheduled_date" | "address"> & {
  client: { full_name: string; phone: string | null } | null;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_SHORT  = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"]; // Sun=0
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const STATUS_CONFIG: Record<string, { badge: string; icon: string }> = {
  planned:     { badge: "bg-blue-100 text-blue-700",       icon: "bg-blue-100 text-blue-600"    },
  in_progress: { badge: "bg-amber-100 text-amber-700",     icon: "bg-amber-100 text-amber-600"  },
  completed:   { badge: "bg-emerald-100 text-emerald-700", icon: "bg-emerald-100 text-emerald-600" },
  cancelled:   { badge: "bg-slate-100 text-slate-500",     icon: "bg-slate-100 text-slate-400"  },
};
const STATUS_LABEL: Record<string, string> = {
  planned: "Planifié", in_progress: "En cours", completed: "Terminé", cancelled: "Annulé",
};
const STATUS_DOT: Record<string, string> = {
  planned: "bg-blue-500", in_progress: "bg-amber-500", completed: "bg-emerald-500", cancelled: "bg-slate-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getMondayOf(d: Date): Date {
  const copy = new Date(d);
  const day  = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function mapsUrl(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.planned;
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", cfg.badge)}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function JobCard({ job, onOpen }: { job: CalendarJob; onOpen: () => void }) {
  const cfg     = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.planned;
  const hasAddr = !!job.address;
  const hasPhone = !!job.client?.phone;
  const cols    = (hasAddr ? 1 : 0) + (hasPhone ? 1 : 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50">
        <span className="text-lg font-black text-slate-900 tabular-nums leading-none">
          {job.scheduled_date ? formatTime(job.scheduled_date) : "—"}
        </span>
        <StatusBadge status={job.status} />
        <span className="flex-1" />
        <button onClick={onOpen}
          className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg active:bg-blue-100">
          Voir →
        </button>
      </div>
      <div className="px-4 py-2.5 flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", cfg.icon)}>
          <Wrench className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-tight">{job.title}</p>
          {job.client && <p className="text-xs font-semibold text-slate-500 mt-0.5">{job.client.full_name}</p>}
          {job.address && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-1">
              <MapPin className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />{job.address}
            </p>
          )}
        </div>
      </div>
      {cols > 0 && (
        <div className={cn("grid border-t border-slate-100 divide-x divide-slate-100", cols === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {hasAddr && (
            <a href={mapsUrl(job.address!)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-blue-600 active:bg-blue-50">
              <MapPin className="w-4 h-4" />Itinéraire
            </a>
          )}
          {hasPhone && (
            <a href={`tel:${job.client!.phone}`}
              className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-emerald-600 active:bg-emerald-50">
              <Phone className="w-4 h-4" />Appeler
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ReminderCard({ reminder }: { reminder: CalendarReminder }) {
  return (
    <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50">
        <span className="text-lg font-black text-slate-900 tabular-nums leading-none">
          {reminder.scheduled_at ? formatTime(reminder.scheduled_at) : "—"}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Rappel</span>
      </div>
      <div className="px-4 py-2.5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Bell className="w-4 h-4 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-tight">{reminder.message || "Rappel"}</p>
          {reminder.client && <p className="text-xs font-semibold text-slate-500 mt-0.5">{reminder.client.full_name}</p>}
        </div>
      </div>
    </div>
  );
}

// Compact "Journée libre" block — ~50% shorter than before
function OptimiserBlock({ urgentRelances }: { urgentRelances: number }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)" }}>
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white leading-tight">
            Journée libre
            {urgentRelances > 0 && (
              <span className="ml-2 text-[11px] text-amber-300 font-bold">
                <AlertTriangle className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                {urgentRelances} relance{urgentRelances > 1 ? "s" : ""}
              </span>
            )}
          </p>
          <p className="text-blue-200 text-[11px] mt-0.5">Profitez-en pour avancer sur vos priorités</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Link href="/relances"
            className="bg-white text-blue-700 rounded-lg py-1.5 px-2.5 text-xs font-bold active:bg-blue-50">
            <Bell className="w-3 h-3 inline -mt-0.5 mr-1" />Relances
          </Link>
          <Link href="/devis"
            className="bg-white/20 text-white rounded-lg py-1.5 px-2.5 text-xs font-bold active:bg-white/30">
            <FileText className="w-3 h-3 inline -mt-0.5 mr-1" />Devis
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlanningCalendar({ jobs, reminders, clients, businessId }: PlanningCalendarProps) {
  const router  = useRouter();
  const supabase = createClient();

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const [calView, setCalView]       = useState<CalView>("month");
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [weekStart, setWeekStart]   = useState<Date>(() => getMondayOf(today));
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addType, setAddType]       = useState<"visit" | "reminder" | null>(null);
  const [addForm, setAddForm]       = useState({ title: "", clientId: "", time: "09:00", notes: "", estimatedHours: "" });
  const [saving, setSaving]         = useState(false);

  // ── Week days ─────────────────────────────────────────────────────────────
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    })
  , [weekStart]);

  // ── Month grid (6 weeks × 7 days = 42 cells, Monday-based) ───────────────
  const monthDays = useMemo(() => {
    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const dow   = first.getDay(); // 0=Sun
    const offset = dow === 0 ? 6 : dow - 1; // leading days from prev month

    const days: Date[] = [];
    for (let i = offset - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    const last = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      days.push(new Date(year, month, d));
    }
    while (days.length < 42) {
      days.push(new Date(year, month + 1, days.length - offset - last + 1));
    }
    return days;
  }, [currentMonth]);

  // ── Week label ────────────────────────────────────────────────────────────
  const weekLabel = useMemo(() => {
    const first = weekDays[0];
    const last  = weekDays[6];
    if (first.getMonth() !== last.getMonth()) {
      return `${MONTHS[first.getMonth()].slice(0,3)} · ${MONTHS[last.getMonth()].slice(0,3)} ${last.getFullYear()}`;
    }
    return `${MONTHS[first.getMonth()]} ${first.getFullYear()}`;
  }, [weekDays]);

  const monthLabel = `${MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  // ── Index events ──────────────────────────────────────────────────────────
  const jobsByDay = useMemo(() => {
    const map: Record<string, CalendarJob[]> = {};
    for (const job of jobs) {
      if (!job.scheduled_date) continue;
      const k = toDateKey(new Date(job.scheduled_date));
      (map[k] ??= []).push(job);
    }
    return map;
  }, [jobs]);

  const remindersByDay = useMemo(() => {
    const map: Record<string, CalendarReminder[]> = {};
    for (const r of reminders) {
      if (!r.scheduled_at) continue;
      const k = toDateKey(new Date(r.scheduled_at));
      (map[k] ??= []).push(r);
    }
    return map;
  }, [reminders]);

  // ── Day events ────────────────────────────────────────────────────────────
  const dayKey = toDateKey(selectedDay);
  const dayJobs = (jobsByDay[dayKey] || []).slice().sort((a, b) =>
    new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime()
  );
  const dayReminders = (remindersByDay[dayKey] || []).slice().sort((a, b) =>
    new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
  );
  const allDayEvents: ({ type: "job"; item: CalendarJob } | { type: "reminder"; item: CalendarReminder })[] =
    [
      ...dayJobs.map((j) => ({ type: "job" as const, item: j })),
      ...dayReminders.map((r) => ({ type: "reminder" as const, item: r })),
    ].sort((a, b) => {
      const ta = a.type === "job" ? new Date(a.item.scheduled_date!).getTime() : new Date(a.item.scheduled_at!).getTime();
      const tb = b.type === "job" ? new Date(b.item.scheduled_date!).getTime() : new Date(b.item.scheduled_at!).getTime();
      return ta - tb;
    });

  const urgentRelances = reminders.filter((r) => r.status === "pending").length;

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToPrev = useCallback(() => {
    if (calView === "month") {
      setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else if (calView === "week") {
      setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    } else {
      setSelectedDay((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
    }
  }, [calView]);

  const goToNext = useCallback(() => {
    if (calView === "month") {
      setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else if (calView === "week") {
      setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    } else {
      setSelectedDay((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
    }
  }, [calView]);

  const goToToday = () => {
    setSelectedDay(today);
    setWeekStart(getMondayOf(today));
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setWeekStart(getMondayOf(day));
    setShowAddSheet(false);
    setAddType(null);
  };

  const handleSwitchView = (v: CalView) => {
    setCalView(v);
    if (v === "week") setWeekStart(getMondayOf(selectedDay));
    if (v === "month") setCurrentMonth(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1));
  };

  // ── Add event ─────────────────────────────────────────────────────────────
  const openAdd = (type: "visit" | "reminder") => {
    setAddType(type);
    setShowAddSheet(true);
  };

  const handleAddEvent = async () => {
    if (!addType) return;
    setSaving(true);
    try {
      const [h, m] = addForm.time.split(":").map(Number);
      const dateTime = new Date(
        selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), h, m
      ).toISOString();

      if (addType === "visit") {
        const { data, error } = await supabase
          .from("jobs")
          .insert({
            business_id: businessId,
            client_id: addForm.clientId || null,
            title: addForm.title || "Visite client",
            status: "planned",
            scheduled_date: dateTime,
            notes: addForm.notes || null,
            estimated_hours: addForm.estimatedHours ? parseFloat(addForm.estimatedHours) : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Visite planifiée !");
        router.refresh();
        setShowAddSheet(false);
        setAddType(null);
        setAddForm({ title: "", clientId: "", time: "09:00", notes: "", estimatedHours: "" });
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
        setAddForm({ title: "", clientId: "", time: "09:00", notes: "", estimatedHours: "" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  // ── Labels ────────────────────────────────────────────────────────────────
  const isSelectedToday = isSameDay(selectedDay, today);
  const dayLabel = selectedDay.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const dayLabelCap = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  const headerLabel = calView === "month" ? monthLabel
    : calView === "week" ? weekLabel
    : dayLabelCap;

  const isCurrentMonthShown = selectedDay.getFullYear() === currentMonth.getFullYear()
    && selectedDay.getMonth() === currentMonth.getMonth();
  const isTodayVisible = calView === "month"
    ? (today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === currentMonth.getMonth())
    : !isSameDay(selectedDay, today);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-slate-50 min-h-full">

      {/* ══ STICKY HEADER ════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">

        {/* Top row: label + nav */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5">
          <span className="text-sm font-black text-slate-900">{headerLabel}</span>
          <div className="flex items-center gap-1">
            <button onClick={goToPrev}
              className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center active:bg-slate-200">
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            </button>
            {!isSameDay(selectedDay, today) || (calView === "month" && !isCurrentMonthShown) ? (
              <button onClick={goToToday}
                className="text-[11px] font-bold text-blue-600 px-2 py-1 bg-blue-50 rounded-lg active:bg-blue-100">
                Auj.
              </button>
            ) : null}
            <button onClick={goToNext}
              className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center active:bg-slate-200">
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* View switch */}
        <div className="px-3 pb-2">
          <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
            {(["month", "week", "day"] as const).map((v) => {
              const labels = { month: "Mois", week: "Semaine", day: "Jour" };
              return (
                <button
                  key={v}
                  onClick={() => handleSwitchView(v)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all",
                    calView === v ? "bg-white shadow-sm text-blue-600" : "text-slate-400"
                  )}
                >
                  {labels[v]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Week strip (week view only) ─────────────────────────────────── */}
        {calView === "week" && (
          <div className="grid grid-cols-7 px-2 pb-2.5 gap-0.5">
            {weekDays.map((day) => {
              const k         = toDateKey(day);
              const isDayToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDay);
              const dayJobDots = [
                ...(jobsByDay[k] || []).map((j) => STATUS_DOT[j.status] ?? "bg-blue-500"),
                ...((remindersByDay[k] || []).length > 0 ? ["bg-orange-400"] : []),
              ].slice(0, 3);

              return (
                <button key={k} onClick={() => handleDayClick(day)}
                  className="flex flex-col items-center py-1 rounded-xl active:bg-slate-50">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    {DAY_SHORT[day.getDay()]}
                  </span>
                  <span className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-black transition-all",
                    isSelected ? "bg-violet-600 text-white shadow-sm shadow-violet-400/40"
                      : isDayToday ? "bg-blue-100 text-blue-700"
                      : "text-slate-700"
                  )}>
                    {day.getDate()}
                  </span>
                  <div className="flex gap-0.5 mt-1 h-1.5 items-center">
                    {dayJobDots.map((color, i) => (
                      <span key={i} className={cn("w-1 h-1 rounded-full", color)} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Month grid (month view only) ────────────────────────────────── */}
        {calView === "month" && (
          <div className="px-2 pb-2">
            {/* Day-of-week headers (Mon→Sun) */}
            <div className="grid grid-cols-7 mb-0.5">
              {[1,2,3,4,5,6,0].map((dow) => (
                <div key={dow} className="text-center text-[10px] font-bold text-slate-400 py-1">
                  {DAY_LETTER[dow]}
                </div>
              ))}
            </div>
            {/* 6 × 7 grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {monthDays.map((day, i) => {
                const isCurrentMo = day.getMonth() === currentMonth.getMonth();
                const isDayToday  = isSameDay(day, today);
                const isSelected  = isSameDay(day, selectedDay);
                const k = toDateKey(day);
                const jCount = (jobsByDay[k] || []).length;
                const rCount = (remindersByDay[k] || []).length;
                const dots = [
                  ...(jobsByDay[k] || []).map((j) => STATUS_DOT[j.status] ?? "bg-blue-500"),
                  ...((remindersByDay[k] || []).length > 0 ? ["bg-orange-400"] : []),
                ].slice(0, 3);

                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(day)}
                    className="flex flex-col items-center py-0.5 rounded-lg active:bg-slate-50"
                  >
                    <span className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold transition-all leading-none",
                      isSelected  ? "bg-violet-600 text-white shadow-sm shadow-violet-400/40"
                        : isDayToday ? "bg-blue-100 text-blue-700 font-black"
                        : isCurrentMo ? "text-slate-700"
                        : "text-slate-300"
                    )}>
                      {day.getDate()}
                    </span>
                    {/* Event dots */}
                    <div className="flex gap-0.5 mt-0.5 h-1.5 items-center min-h-[6px]">
                      {dots.map((color, di) => (
                        <span key={di} className={cn("w-1 h-1 rounded-full", color)} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══ DAY DETAIL ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-10">

        {/* Day header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-900 leading-tight">{dayLabelCap}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {allDayEvents.length > 0
                ? `${allDayEvents.length} événement${allDayEvents.length > 1 ? "s" : ""}`
                : isSelectedToday ? "Journée libre" : "Aucun événement"}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => openAdd("visit")}
              className="flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-bold px-3 py-1.5 rounded-xl active:bg-blue-100">
              <Plus className="w-3.5 h-3.5" />Visite
            </button>
            <button onClick={() => openAdd("reminder")}
              className="flex items-center gap-1 bg-orange-50 text-orange-700 text-[11px] font-bold px-3 py-1.5 rounded-xl active:bg-orange-100">
              <Bell className="w-3.5 h-3.5" />Rappel
            </button>
          </div>
        </div>

        {/* Add event inline form */}
        {showAddSheet && addType && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-700">
                {addType === "visit" ? "Planifier une visite" : "Ajouter un rappel"}
              </p>
              <button onClick={() => { setShowAddSheet(false); setAddType(null); }}
                className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              <input
                type="text"
                placeholder={addType === "visit" ? "Titre (ex: Visite diagnostic)" : "Message du rappel"}
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={addForm.clientId}
                  onChange={(e) => setAddForm((f) => ({ ...f, clientId: e.target.value }))}
                  className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Client (optionnel)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={addForm.time}
                  onChange={(e) => setAddForm((f) => ({ ...f, time: e.target.value }))}
                  className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              {addType === "visit" && (
                <select
                  value={addForm.estimatedHours}
                  onChange={(e) => setAddForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                  className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Durée estimée (optionnel)</option>
                  <option value="1">1 heure</option>
                  <option value="2">2 heures</option>
                  <option value="3">3 heures</option>
                  <option value="4">½ journée (4h)</option>
                  <option value="8">1 journée (8h)</option>
                  <option value="16">2 jours</option>
                </select>
              )}
              <textarea
                placeholder="Notes…"
                value={addForm.notes}
                onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
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

        {/* Events */}
        {allDayEvents.length > 0 ? (
          allDayEvents.map((ev) =>
            ev.type === "job"
              ? <JobCard key={ev.item.id} job={ev.item} onOpen={() => router.push(`/chantiers/${ev.item.id}`)} />
              : <ReminderCard key={ev.item.id} reminder={ev.item} />
          )
        ) : !showAddSheet && (
          <OptimiserBlock urgentRelances={urgentRelances} />
        )}

        {/* Upcoming events mini-list */}
        {(() => {
          const upcoming = jobs
            .filter((j) => j.scheduled_date && new Date(j.scheduled_date) > selectedDay)
            .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())
            .slice(0, 5);

          if (upcoming.length === 0) return null;

          return (
            <div className="pt-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Prochains chantiers</p>
              <div className="flex flex-col gap-1.5">
                {upcoming.map((job) => {
                  const d = new Date(job.scheduled_date!);
                  const label = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
                  return (
                    <button
                      key={job.id}
                      onClick={() => {
                        const day = new Date(job.scheduled_date!);
                        day.setHours(0,0,0,0);
                        handleDayClick(day);
                        if (calView === "month") {
                          setCurrentMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                        }
                      }}
                      className="bg-white rounded-xl border border-slate-100 px-3 py-2.5 flex items-center gap-3 active:bg-slate-50 text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{job.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {label} · {formatTime(job.scheduled_date!)}
                          {job.client ? ` · ${job.client.full_name}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
