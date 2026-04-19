import { createServerSupabaseClient } from "@/lib/supabase/server";
import EstimateForm from "@/components/estimates/EstimateForm";

export default async function NouveauDevisPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .single();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, company_name, phone, email, address")
    .eq("business_id", business?.id || "")
    .order("full_name");

  return (
    <EstimateForm
      business={business}
      clients={(clients || []) as any}
      mode="create"
    />
  );
}
