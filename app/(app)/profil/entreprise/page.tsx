import { createServerSupabaseClient } from "@/lib/supabase/server";
import BusinessProfileForm from "@/components/profile/BusinessProfileForm";

export default async function EntreprisePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user!.id)
    .maybeSingle();

  return <BusinessProfileForm business={business} userId={user!.id} />;
}
