"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Business, DashboardMetrics } from "@/lib/types";

const supabase = createClient();

// Hook pour les métriques du dashboard
export function useDashboardMetrics(businessId: string | undefined) {
  return useSWR(
    businessId ? ["dashboard-metrics", businessId] : null,
    async () => {
      if (!businessId) return null;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { data: pendingEstimates },
        { data: viewedEstimates },
        { data: activeJobs },
        { data: paidEstimates },
        { data: pendingReminders },
      ] = await Promise.all([
        // Devis en attente (sent + viewed)
        supabase
          .from("estimates")
          .select("total_amount_ht, vat_rate, status")
          .eq("business_id", businessId)
          .in("status", ["sent", "viewed", "accepted"]),
        // Devis vus mais non signés depuis 48h
        supabase
          .from("estimates")
          .select("id")
          .eq("business_id", businessId)
          .eq("status", "viewed")
          .lt("viewed_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString()),
        // Chantiers en cours
        supabase
          .from("jobs")
          .select("id")
          .eq("business_id", businessId)
          .in("status", ["planned", "in_progress"]),
        // CA payé ce mois
        supabase
          .from("estimates")
          .select("total_amount_ht, vat_rate")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .gte("paid_at", startOfMonth),
        // Relances en attente
        supabase
          .from("reminders")
          .select("id")
          .eq("business_id", businessId)
          .eq("status", "pending"),
      ]);

      const pendingAmount = (pendingEstimates || []).reduce(
        (sum, e) => sum + (e.total_amount_ht || 0),
        0
      );

      const monthRevenue = (paidEstimates || []).reduce(
        (sum, e) => sum + (e.total_amount_ht || 0) * (1 + (e.vat_rate || 20) / 100),
        0
      );

      return {
        pendingEstimatesAmount: pendingAmount,
        pendingReminders: pendingReminders?.length || 0,
        activeJobs: activeJobs?.length || 0,
        monthRevenue,
        pendingCount: pendingEstimates?.length || 0,
        viewedNotSigned: viewedEstimates?.length || 0,
      } satisfies DashboardMetrics;
    },
    { refreshInterval: 30000 } // Refresh toutes les 30 secondes
  );
}
