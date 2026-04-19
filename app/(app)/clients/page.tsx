import { createServerSupabaseClient } from "@/lib/supabase/server";
import ClientList from "@/components/clients/ClientList";

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", session!.user.id)
    .single();

  // No clients fetch — the layout already seeded the SWR cache.
  // ClientList reads from SWR fallback instantly.
  return <ClientList clients={[]} businessId={business?.id || ""} />;
}
