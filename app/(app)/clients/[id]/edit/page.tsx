import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ClientForm from "@/components/clients/ClientForm";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", session!.user.id)
    .single();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("business_id", business?.id || "")
    .single();

  if (!client) notFound();

  return <ClientForm businessId={business?.id || ""} mode="edit" client={client} />;
}
