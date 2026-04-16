import { createServerSupabaseClient } from "@/lib/supabase/server";
import ClientForm from "@/components/clients/ClientForm";

export default async function NouveauClientPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  return <ClientForm businessId={business?.id || ""} mode="create" />;
}
