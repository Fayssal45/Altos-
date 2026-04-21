import { createServerSupabaseClient } from "@/lib/supabase/server";
import RadarView from "@/components/commercial/RadarView";

export default async function RadarPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .single();

  const checklist = (business?.visibility_checklist as Record<string, boolean>) ?? {};

  return <RadarView business={business!} initialChecklist={checklist} />;
}
