"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";

export type NotificationCategory = "urgent" | "today" | "admin";

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  subtitle?: string;
  href: string;
  timestamp?: string;
  type: "reminder" | "viewed_quote" | "accepted_quote" | "today_job";
}

const supabase = createClient();

export function useNotifications(businessId: string | undefined) {
  return useSWR(
    businessId ? ["notifications", businessId] : null,
    async (): Promise<AppNotification[]> => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

      const [
        { data: todayJobs },
        { data: viewedQuotes },
        { data: acceptedQuotes },
        { data: pendingReminders },
      ] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, title, scheduled_date, client:clients(full_name)")
          .eq("business_id", businessId!)
          .gte("scheduled_date", todayStart)
          .lt("scheduled_date", todayEnd)
          .in("status", ["planned", "in_progress"])
          .order("scheduled_date", { ascending: true })
          .limit(10),
        supabase
          .from("estimates")
          .select("id, number, title, viewed_at, client:clients(full_name)")
          .eq("business_id", businessId!)
          .eq("status", "viewed")
          .lt("viewed_at", fortyEightHoursAgo)
          .limit(10),
        supabase
          .from("estimates")
          .select("id, number, title, signed_at, client:clients(full_name)")
          .eq("business_id", businessId!)
          .eq("status", "accepted")
          .order("signed_at", { ascending: false })
          .limit(5),
        supabase
          .from("reminders")
          .select("id, message, estimate:estimates(id, title, number), client:clients(full_name)")
          .eq("business_id", businessId!)
          .eq("status", "pending")
          .limit(10),
      ]);

      const notifications: AppNotification[] = [];

      // Today's interventions
      for (const job of todayJobs || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (job as any).client as { full_name: string } | null;
        notifications.push({
          id: `job-${job.id}`,
          category: "today",
          title: job.title,
          subtitle: client?.full_name,
          href: `/chantiers/${job.id}`,
          timestamp: job.scheduled_date || undefined,
          type: "today_job",
        });
      }

      // Viewed quotes without response > 48h (urgent)
      for (const e of viewedQuotes || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (e as any).client as { full_name: string } | null;
        const label = [e.title || e.number, client?.full_name].filter(Boolean).join(" · ");
        notifications.push({
          id: `viewed-${e.id}`,
          category: "urgent",
          title: "Devis consulté sans réponse",
          subtitle: label || undefined,
          href: `/devis/${e.id}/edit`,
          timestamp: e.viewed_at || undefined,
          type: "viewed_quote",
        });
      }

      // Pending reminders (urgent)
      for (const r of pendingReminders || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ra = r as any;
        const estimateSub: string = ra.estimate?.title || ra.estimate?.number || "";
        const clientSub: string = ra.client?.full_name || "";
        const sub = [estimateSub, clientSub].filter(Boolean).join(" · ");
        notifications.push({
          id: `reminder-${r.id}`,
          category: "urgent",
          title: r.message || "Relance à envoyer",
          subtitle: sub || undefined,
          href: "/relances",
          type: "reminder",
        });
      }

      // Accepted quotes to collect (admin)
      for (const e of acceptedQuotes || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (e as any).client as { full_name: string } | null;
        const label = [e.title || e.number, client?.full_name].filter(Boolean).join(" · ");
        notifications.push({
          id: `accepted-${e.id}`,
          category: "admin",
          title: "Devis accepté — à encaisser",
          subtitle: label || undefined,
          href: `/devis/${e.id}/edit`,
          timestamp: e.signed_at || undefined,
          type: "accepted_quote",
        });
      }

      return notifications;
    },
    { refreshInterval: 60000 }
  );
}
