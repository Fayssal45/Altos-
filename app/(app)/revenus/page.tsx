import { createServerSupabaseClient } from "@/lib/supabase/server";
import RevenusView from "@/components/revenus/RevenusView";

export default async function RevenusPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, vat_regime")
    .eq("owner_id", session!.user.id)
    .single();

  if (!business) return null;

  // Fetch last 2 years — period filtering happens client-side
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const { data: raw } = await supabase
    .from("estimates")
    .select(`
      id, number, title, status,
      total_amount_ht, vat_rate,
      issued_at, paid_at,
      client:clients(id, full_name, company_name)
    `)
    .eq("business_id", business.id)
    .gte("issued_at", twoYearsAgo.toISOString())
    .not("status", "in", '("draft","archived")')
    .order("issued_at", { ascending: false });

  const estimates = (raw || []).map((e) => ({
    ...e,
    client: Array.isArray(e.client) ? (e.client[0] ?? null) : (e.client ?? null),
  }));

  return <RevenusView estimates={estimates as any} business={business} />;
}
