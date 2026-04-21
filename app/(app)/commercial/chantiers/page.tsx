import { createServerSupabaseClient } from "@/lib/supabase/server";
import ChantiersView from "@/components/commercial/ChantiersView";

export default async function ChantiersCommercialPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .single();

  const { data: showcases } = await supabase
    .from("project_showcases")
    .select("*, job:jobs(title)")
    .eq("business_id", business?.id ?? "")
    .order("created_at", { ascending: false });

  return (
    <ChantiersView
      business={business!}
      showcases={(showcases ?? []) as any}
    />
  );
}
