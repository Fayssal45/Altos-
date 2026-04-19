import { createServerSupabaseClient } from "@/lib/supabase/server";
import ComptabiliteForm from "@/components/profile/ComptabiliteForm";
import type { BusinessIntegration } from "@/lib/types";

export default async function ComptabilitePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  // Fetch business first — we need its id and accounting_provider
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .maybeSingle();

  // Fetch the integration record for whichever provider is currently selected
  let integration: BusinessIntegration | null = null;
  if (business?.id && business.accounting_provider) {
    const { data } = await supabase
      .from("business_integrations")
      .select("*")
      .eq("business_id", business.id)
      .eq("provider", business.accounting_provider)
      .maybeSingle();
    integration = data as BusinessIntegration | null;
  }

  return <ComptabiliteForm business={business} integration={integration} />;
}
