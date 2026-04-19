import { createServerSupabaseClient } from "@/lib/supabase/server";
import HomeScreen from "@/components/terrain/HomeScreen";

export default async function TerrainPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .maybeSingle();

  const bid = business?.id ?? "";

  const now = new Date();
  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const h48ago        = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  // All queries fire in parallel — data used by terrain OR admin blocks as needed.
  const [
    { data: nextJobs },
    { data: pendingEstimates },
    { count: urgentRelances },
    { data: recentInvoices },
    { data: monthPaid },
  ] = await Promise.all([
    // ── Terrain: upcoming interventions ──
    supabase
      .from("jobs")
      .select("id, title, status, scheduled_date, address, client:clients(id, full_name, phone, address, city)")
      .eq("business_id", bid)
      .in("status", ["planned", "in_progress"])
      .gte("scheduled_date", todayStart)
      .order("scheduled_date", { ascending: true })
      .limit(3),

    // ── Terrain + Admin: pending estimates (sent / viewed) ──
    supabase
      .from("estimates")
      .select("id, number, title, status, total_amount_ht, vat_rate, viewed_at, created_at, client:clients(id, full_name, phone)")
      .eq("business_id", bid)
      .in("status", ["sent", "viewed"])
      .order("created_at", { ascending: false })
      .limit(6),

    // ── Terrain: viewed estimates > 48h without signing ──
    supabase
      .from("estimates")
      .select("id", { count: "exact", head: true })
      .eq("business_id", bid)
      .eq("status", "viewed")
      .lt("viewed_at", h48ago),

    // ── Admin: recent invoices (accepted / invoiced / paid) ──
    supabase
      .from("estimates")
      .select("id, number, title, status, total_amount_ht, vat_rate, paid_at, signed_at, issued_at, client:clients(id, full_name)")
      .eq("business_id", bid)
      .in("status", ["accepted", "invoiced", "paid"])
      .order("updated_at", { ascending: false })
      .limit(5),

    // ── Admin: this month's paid revenue ──
    supabase
      .from("estimates")
      .select("total_amount_ht, vat_rate")
      .eq("business_id", bid)
      .eq("status", "paid")
      .gte("paid_at", startOfMonth),
  ]);

  const monthRevenueTTC = (monthPaid ?? []).reduce(
    (s: number, e: { total_amount_ht: number; vat_rate: number }) =>
      s + e.total_amount_ht * (1 + e.vat_rate / 100),
    0
  );

  return (
    <HomeScreen
      business={business}
      nextJobs={(nextJobs ?? []) as any}
      pendingEstimates={(pendingEstimates ?? []) as any}
      urgentRelances={urgentRelances ?? 0}
      recentInvoices={(recentInvoices ?? []) as any}
      monthRevenueTTC={monthRevenueTTC}
    />
  );
}
