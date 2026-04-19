import { createServerSupabaseClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard/Dashboard";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  // getSession() — zero network call, middleware already validated the JWT
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .maybeSingle();

  const bid = business?.id || "";

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  ).toISOString();

  // All 6 data queries fire in parallel — no sequential waiting
  const [
    { data: todayJobs },
    { data: recentEstimates },
    { data: recentJobs },
    { data: upcomingJobs },
    { data: unpaidEstimates },
    { count: clientsCount },
  ] = await Promise.all([
    // Brief du jour — chantiers planifiés aujourd'hui OU en cours
    supabase
      .from("jobs")
      .select(
        `id, title, status, scheduled_date, address, estimated_hours, notes,
         client:clients(id, full_name, phone, address, city),
         estimate:estimates(id, number, total_amount_ht, vat_rate)`
      )
      .eq("business_id", bid)
      .or(
        `and(scheduled_date.gte.${todayStart},scheduled_date.lt.${todayEnd}),status.eq.in_progress`
      )
      .in("status", ["planned", "in_progress"])
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .limit(10),

    // Devis récents
    supabase
      .from("estimates")
      .select(
        "id, number, title, status, total_amount_ht, vat_rate, created_at, client:clients(id, full_name, phone, city, address)"
      )
      .eq("business_id", bid)
      .order("created_at", { ascending: false })
      .limit(8),

    // Interventions récentes
    supabase
      .from("jobs")
      .select("id, title, status, created_at, client:clients(id, full_name, city)")
      .eq("business_id", bid)
      .order("created_at", { ascending: false })
      .limit(5),

    // Chantiers à venir
    supabase
      .from("jobs")
      .select(
        "id, title, status, scheduled_date, address, client:clients(id, full_name, phone, city, address)"
      )
      .eq("business_id", bid)
      .in("status", ["planned", "in_progress"])
      .gte("scheduled_date", todayEnd)
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .limit(4),

    // Devis acceptés non payés
    supabase
      .from("estimates")
      .select(
        "id, number, title, total_amount_ht, vat_rate, signed_at, client:clients(full_name, phone)"
      )
      .eq("business_id", bid)
      .eq("status", "accepted")
      .order("signed_at", { ascending: true })
      .limit(5),

    // Nombre de clients
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("business_id", bid),
  ]);

  return (
    <Dashboard
      business={business}
      todayJobs={(todayJobs || []) as any}
      recentEstimates={(recentEstimates || []) as any}
      recentJobs={(recentJobs || []) as any}
      upcomingJobs={(upcomingJobs || []) as any}
      unpaidEstimates={(unpaidEstimates || []) as any}
      clientsCount={clientsCount || 0}
    />
  );
}
