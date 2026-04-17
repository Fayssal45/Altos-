import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ClientDetail from "@/components/clients/ClientDetail";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("business_id", business?.id || "")
    .single();

  if (!client) notFound();

  const [{ data: estimates }, { count: jobsCount }, { data: lastJob }] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, number, title, status, total_amount_ht, vat_rate, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("client_id", id)
      .eq("business_id", business?.id || ""),
    supabase
      .from("jobs")
      .select("created_at")
      .eq("client_id", id)
      .eq("business_id", business?.id || "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lastActivity = lastJob?.created_at || estimates?.[0]?.created_at || null;

  return (
    <ClientDetail
      client={client}
      estimates={estimates || []}
      jobsCount={jobsCount || 0}
      lastActivity={lastActivity}
    />
  );
}
