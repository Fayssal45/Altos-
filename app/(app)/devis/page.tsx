import { createServerSupabaseClient } from "@/lib/supabase/server";
import EstimateList from "@/components/estimates/EstimateList";

export default async function DevisPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .single();

  // No estimates fetch — the layout already seeded the SWR cache with
  // estimates data. EstimateList reads from SWR fallback instantly.
  return <EstimateList estimates={[]} businessName={business?.name || ""} business={business} />;
}
