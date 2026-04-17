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

  // Bornes de la journée (UTC)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  // Brief du jour — chantiers planifiés aujourd'hui OU en cours
  const { data: todayJobs } = await supabase
    .from("jobs")
    .select(`
      id, title, status, scheduled_date, address, estimated_hours, notes,
      client:clients(id, full_name, phone, address, city),
      estimate:estimates(id, number, total_amount_ht, vat_rate)
    `)
    .eq("business_id", business?.id || "")
    .or(
      `and(scheduled_date.gte.${todayStart},scheduled_date.lt.${todayEnd}),status.eq.in_progress`
    )
    .in("status", ["planned", "in_progress"])
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .limit(10);

  // Devis récents (5 derniers) — avec contact client pour actions rapides
  const { data: recentEstimates } = await supabase
    .from("estimates")
    .select("id, number, title, status, total_amount_ht, vat_rate, created_at, client:clients(id, full_name, phone, city, address)")
    .eq("business_id", business?.id || "")
    .order("created_at", { ascending: false })
    .limit(5);

  // Chantiers à venir (hors aujourd'hui) — avec données client enrichies
  const { data: upcomingJobs } = await supabase
    .from("jobs")
    .select("id, title, status, scheduled_date, address, client:clients(id, full_name, phone, city, address)")
    .eq("business_id", business?.id || "")
    .in("status", ["planned", "in_progress"])
    .gte("scheduled_date", todayEnd)
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
      todayJobs={(todayJobs || []) as any}
      recentEstimates={(recentEstimates || []) as any}
      upcomingJobs={(upcomingJobs || []) as any}
      unpaidEstimates={(unpaidEstimates || []) as any}
      clientsCount={clientsCount || 0}
    />
  );
}
