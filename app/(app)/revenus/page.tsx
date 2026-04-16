import { createServerSupabaseClient } from "@/lib/supabase/server";
import RevenusView from "@/components/revenus/RevenusView";

export default async function RevenusPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    { data: paidThisYearRaw },
    { data: pendingEstimates },
    { data: paidThisMonth },
  ] = await Promise.all([
    supabase
      .from("estimates")
      .select("total_amount_ht, vat_rate, paid_at, title, number, client:clients(full_name)")
      .eq("business_id", business?.id || "")
      .eq("status", "paid")
      .gte("paid_at", startOfYear)
      .order("paid_at", { ascending: false }),
    supabase
      .from("estimates")
      .select("total_amount_ht, vat_rate, status, title, number")
      .eq("business_id", business?.id || "")
      .in("status", ["sent", "viewed", "accepted"]),
    supabase
      .from("estimates")
      .select("total_amount_ht, vat_rate")
      .eq("business_id", business?.id || "")
      .eq("status", "paid")
      .gte("paid_at", startOfMonth),
  ]);

  // Normalize client join (Supabase returns array for joined tables)
  const paidThisYear = (paidThisYearRaw || []).map((e) => ({
    ...e,
    client: Array.isArray(e.client) ? (e.client[0] ?? null) : (e.client ?? null),
  }));

  return (
    <RevenusView
      paidThisYear={paidThisYear as any}
      pendingEstimates={pendingEstimates || []}
      paidThisMonth={paidThisMonth || []}
    />
  );
}
