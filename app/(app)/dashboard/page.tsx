import { createServerSupabaseClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard/Dashboard";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user!.id)
    .maybeSingle();

  // Devis récents (5 derniers)
  const { data: recentEstimates } = await supabase
    .from("estimates")
    .select("id, number, title, status, total_amount_ht, vat_rate, created_at, client:clients(full_name)")
    .eq("business_id", business?.id || "")
    .order("created_at", { ascending: false })
    .limit(5);

  // Chantiers à venir (planifiés ou en cours)
  const { data: upcomingJobs } = await supabase
    .from("jobs")
    .select("id, title, status, scheduled_date, client:clients(full_name)")
    .eq("business_id", business?.id || "")
    .in("status", ["planned", "in_progress"])
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .limit(4);

  // Devis non payés (acceptés)
  const { data: unpaidEstimates } = await supabase
    .from("estimates")
    .select("id, number, title, total_amount_ht, vat_rate, signed_at, client:clients(full_name, phone)")
    .eq("business_id", business?.id || "")
    .eq("status", "accepted")
    .order("signed_at", { ascending: true })
    .limit(5);

  // Nombre de clients
  const { count: clientsCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business?.id || "");

  return (
    <Dashboard
      business={business}
      recentEstimates={(recentEstimates || []) as any}
      upcomingJobs={(upcomingJobs || []) as any}
      unpaidEstimates={(unpaidEstimates || []) as any}
      clientsCount={clientsCount || 0}
    />
  );
}
