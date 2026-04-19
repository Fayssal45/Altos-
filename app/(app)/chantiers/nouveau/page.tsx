import { createServerSupabaseClient } from "@/lib/supabase/server";
import JobForm from "@/components/jobs/JobForm";

export default async function NouveauChantierPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", session!.user.id)
    .single();

  const [{ data: clients }, { data: estimates }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, company_name")
      .eq("business_id", business?.id || "")
      .order("full_name"),
    supabase
      .from("estimates")
      .select("id, number, title, status")
      .eq("business_id", business?.id || "")
      .in("status", ["accepted", "sent", "viewed"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return <JobForm businessId={business?.id || ""} clients={clients || []} estimates={estimates || []} />;
}
