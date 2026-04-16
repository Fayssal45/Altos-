"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { DashboardMetrics } from "@/lib/types";

const supabase = createClient();

export function useDashboardMetrics(businessId: string | undefined) {
  return useSWR(
    businessId ? ["dashboard-metrics", businessId] : null,
    async () => {
      if (!businessId) return null;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      const [
        { data: pendingEstimates },
        { data: viewedEstimates },
        { data: activeJobs },
        { data: paidThisMonth },
        { data: paidLastMonth },
        { data: pendingReminders },
        { data: sentThisMonth },
        { data: acceptedThisMonth },
      ] = await Promise.all([
        supabase
          .from("estimates")
          .select("total_amount_ht, vat_rate, status")
          .eq("business_id", businessId)
          .in("status", ["sent", "viewed", "accepted"]),
        supabase
          .from("estimates")
          .select("id")
          .eq("business_id", businessId)
          .eq("status", "viewed")
          .lt("viewed_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString()),
        supabase
          .from("jobs")
          .select("id")
          .eq("business_id", businessId)
          .in("status", ["planned", "in_progress"]),
        supabase
          .from("estimates")
          .select("total_amount_ht, vat_rate")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .gte("paid_at", startOfMonth),
        supabase
          .from("estimates")
          .select("total_amount_ht, vat_rate")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .gte("paid_at", startOfPrevMonth)
          .lte("paid_at", endOfPrevMonth),
        supabase
          .from("reminders")
          .select("id")
          .eq("business_id", businessId)
          .eq("status", "pending"),
        supabase
          .from("estimates")
          .select("id")
          .eq("business_id", businessId)
          .in("status", ["sent", "viewed", "accepted", "paid"])
          .gte("created_at", startOfMonth),
        supabase
          .from("estimates")
          .select("id")
          .eq("business_id", businessId)
          .in("status", ["accepted", "paid"])
          .gte("created_at", startOfMonth),
      ]);

      const toTTC = (rows: { total_amount_ht: number; vat_rate: number }[] | null) =>
        (rows || []).reduce((s, e) => s + e.total_amount_ht * (1 + e.vat_rate / 100), 0);

      return {
        pendingEstimatesAmount: (pendingEstimates || []).reduce((s, e) => s + e.total_amount_ht, 0),
        pendingReminders: pendingReminders?.length || 0,
        activeJobs: activeJobs?.length || 0,
        monthRevenue: toTTC(paidThisMonth),
        prevMonthRevenue: toTTC(paidLastMonth),
        pendingCount: pendingEstimates?.length || 0,
        viewedNotSigned: viewedEstimates?.length || 0,
        sentCount: sentThisMonth?.length || 0,
        acceptedCount: acceptedThisMonth?.length || 0,
      } satisfies DashboardMetrics;
    },
    { refreshInterval: 30000 }
  );
}
