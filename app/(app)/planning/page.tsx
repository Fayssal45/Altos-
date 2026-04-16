import { createServerSupabaseClient } from "@/lib/supabase/server";
import PlanningCalendar from "@/components/planning/PlanningCalendar";

export default async function PlanningPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const businessId = business?.id || "";

  // Load 3 months of data (prev + current + next)
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString();

  const [{ data: jobs }, { data: reminders }, { data: clients }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, status, scheduled_date, address, client:clients(full_name)")
      .eq("business_id", businessId)
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", rangeStart)
      .lte("scheduled_date", rangeEnd)
      .order("scheduled_date", { ascending: true }),
    supabase
      .from("reminders")
      .select("id, type, scheduled_at, message, status, client:clients(full_name)")
      .eq("business_id", businessId)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", rangeStart)
      .lte("scheduled_at", rangeEnd)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("clients")
      .select("id, full_name, phone, email, company_name")
      .eq("business_id", businessId)
      .order("full_name"),
  ]);

  return (
    <PlanningCalendar
      jobs={(jobs || []) as any}
      reminders={(reminders || []) as any}
      clients={(clients || []) as any}
      businessId={businessId}
    />
  );
}
