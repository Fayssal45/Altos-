import { createServerSupabaseClient } from "@/lib/supabase/server";
import QuickIntervention from "@/components/interventions/QuickIntervention";

export default async function NouvelleInterventionPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .maybeSingle();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, company_name, phone, email, address, city, postal_code")
    .eq("business_id", business?.id || "")
    .order("full_name");

  return (
    <QuickIntervention
      business={business}
      clients={(clients || []) as any}
    />
  );
}
