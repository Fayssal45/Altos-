import { createServerSupabaseClient } from "@/lib/supabase/server";
import JobList from "@/components/jobs/JobList";

export default async function ChantiersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", session!.user.id)
    .single();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, client:clients(full_name, phone), estimate:estimates(number, total_amount_ht, vat_rate)")
    .eq("business_id", business?.id || "")
    .order("scheduled_date", { ascending: true, nullsFirst: false });

  return <JobList jobs={jobs || []} businessId={business?.id || ""} />;
}
