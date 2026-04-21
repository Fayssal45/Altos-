import { createServerSupabaseClient } from "@/lib/supabase/server";
import RelancesClarteView from "@/components/commercial/RelancesClarteView";

export default async function RelancesClarteePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, phone")
    .eq("owner_id", session!.user.id)
    .single();

  const bid = business?.id ?? "";
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // All clients + their last estimate date
  const [{ data: clients }, { data: recentEstimates }] = await Promise.all([
    supabase.from("clients").select("*").eq("business_id", bid).order("full_name"),
    supabase
      .from("estimates")
      .select("client_id, created_at")
      .eq("business_id", bid)
      .gte("created_at", ninetyDaysAgo),
  ]);

  const recentClientIds = new Set((recentEstimates ?? []).map((e) => e.client_id).filter(Boolean));

  // All estimates for inactive clients — to get their last_estimate_at
  const inactiveClients = (clients ?? []).filter((c) => !recentClientIds.has(c.id));

  const { data: lastEstimates } = await supabase
    .from("estimates")
    .select("client_id, created_at")
    .eq("business_id", bid)
    .in("client_id", inactiveClients.map((c) => c.id).slice(0, 50))
    .order("created_at", { ascending: false });

  const lastEstimateByClient: Record<string, string> = {};
  for (const est of lastEstimates ?? []) {
    if (est.client_id && !lastEstimateByClient[est.client_id]) {
      lastEstimateByClient[est.client_id] = est.created_at;
    }
  }

  const inactiveWithDate = inactiveClients.map((c) => ({
    ...c,
    last_estimate_at: lastEstimateByClient[c.id] ?? null,
  })).sort((a, b) => {
    // Sort: never active first, then oldest activity first
    if (!a.last_estimate_at && !b.last_estimate_at) return 0;
    if (!a.last_estimate_at) return -1;
    if (!b.last_estimate_at) return 1;
    return new Date(a.last_estimate_at).getTime() - new Date(b.last_estimate_at).getTime();
  });

  return (
    <RelancesClarteView
      businessName={business?.name ?? ""}
      businessPhone={business?.phone ?? null}
      inactiveClients={inactiveWithDate as any}
    />
  );
}
