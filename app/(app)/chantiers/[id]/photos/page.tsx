import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import JobPhotos from "@/components/jobs/JobPhotos";

export default async function JobPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, client:clients(full_name)")
    .eq("id", id)
    .single();

  if (!job) notFound();

  const { data: photos } = await supabase
    .from("job_photos")
    .select("*")
    .eq("job_id", id)
    .order("created_at");

  return <JobPhotos job={job} photos={photos || []} />;
}
