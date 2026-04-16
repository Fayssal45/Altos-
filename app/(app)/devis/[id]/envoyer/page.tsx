import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EnvoyerDevis from "@/components/estimates/EnvoyerDevis";

export default async function EnvoyerDevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, client:clients(*)")
    .eq("id", id)
    .single();

  if (!estimate) notFound();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", estimate.business_id)
    .single();

  return <EnvoyerDevis estimate={estimate} business={business} />;
}
