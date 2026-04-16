import { createServerSupabaseClient } from "@/lib/supabase/server";
import EstimateList from "@/components/estimates/EstimateList";

export default async function DevisPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const { data: estimates } = await supabase
    .from("estimates")
    .select("*, client:clients(full_name, phone, company_name)")
    .eq("business_id", business?.id || "")
    .order("created_at", { ascending: false })
    .limit(50);

  return <EstimateList estimates={estimates || []} />;
}
