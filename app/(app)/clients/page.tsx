import { createServerSupabaseClient } from "@/lib/supabase/server";
import ClientList from "@/components/clients/ClientList";

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("business_id", business?.id || "")
    .order("full_name");

  return <ClientList clients={clients || []} />;
}
