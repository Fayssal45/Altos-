import { createServerSupabaseClient } from "@/lib/supabase/server";
import ParrainageView from "@/components/commercial/ParrainageView";

export default async function ParrainagePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, phone")
    .eq("owner_id", session!.user.id)
    .single();

  const businessId = business?.id ?? "";

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, phone, email, company_name")
    .eq("business_id", businessId)
    .order("full_name");

  return (
    <ParrainageView
      businessName={business?.name ?? ""}
      businessPhone={business?.phone ?? null}
      clients={(clients || []) as any}
    />
  );
}
