import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import JobDetail from "@/components/jobs/JobDetail";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, client:clients(full_name, phone, email), estimate:estimates(number, title, total_amount_ht, vat_rate)")
    .eq("id", id)
    .single();

  if (!job) notFound();

  const { data: photos } = await supabase
    .from("job_photos")
    .select("*")
    .eq("job_id", id)
    .order("created_at");

  return <JobDetail job={job} photos={photos || []} />;
}
