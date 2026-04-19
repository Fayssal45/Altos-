import { createServerSupabaseClient } from "@/lib/supabase/server";
import RelancesList from "@/components/relances/RelancesList";

export default async function RelancesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .single();

  // Devis vus mais non signés depuis +48h
  const cutoff48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const [
    { data: viewedEstimates },
    { data: reminders },
  ] = await Promise.all([
    supabase
      .from("estimates")
      .select("*, client:clients(full_name, phone, company_name)")
      .eq("business_id", business?.id || "")
      .in("status", ["viewed", "sent"])
      .order("viewed_at", { ascending: false }),
    supabase
      .from("reminders")
      .select("*, estimate:estimates(number, title, share_token), client:clients(full_name, phone)")
      .eq("business_id", business?.id || "")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <RelancesList
      viewedEstimates={viewedEstimates || []}
      reminders={reminders || []}
      business={business}
    />
  );
}
