import { createServerSupabaseClient } from "@/lib/supabase/server";
import CommercialHub from "@/components/commercial/CommercialHub";

export default async function CommercialPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, google_review_url, visibility_checklist")
    .eq("owner_id", session!.user.id)
    .single();

  const bid = business?.id ?? "";
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: reviewCount },
    { count: showcaseCount },
    { count: pendingEstimatesCount },
    { data: recentClientIds },
    { count: totalClients },
  ] = await Promise.all([
    supabase.from("review_requests").select("id", { count: "exact", head: true }).eq("business_id", bid),
    supabase.from("project_showcases").select("id", { count: "exact", head: true }).eq("business_id", bid),
    supabase.from("estimates").select("id", { count: "exact", head: true })
      .eq("business_id", bid)
      .in("status", ["sent", "viewed"]),
    supabase.from("estimates").select("client_id").eq("business_id", bid).gte("created_at", ninetyDaysAgo),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("business_id", bid),
  ]);

  const activeClientIds = new Set((recentClientIds ?? []).map((r) => r.client_id).filter(Boolean));
  const inactiveCount   = Math.max(0, (totalClients ?? 0) - activeClientIds.size);

  const rawChecklist  = (business?.visibility_checklist as Record<string, boolean>) ?? {};
  const TOTAL_ITEMS   = 6; // matches simplified RadarView CHECKLIST length
  const checklistDone = Object.values(rawChecklist).filter(Boolean).length;

  return (
    <CommercialHub
      reviewCount={reviewCount ?? 0}
      googleConfigured={!!(business?.google_review_url)}
      showcaseCount={showcaseCount ?? 0}
      pendingEstimatesCount={pendingEstimatesCount ?? 0}
      inactiveClientCount={inactiveCount}
      checklistDone={checklistDone}
      checklistTotal={TOTAL_ITEMS}
    />
  );
}
