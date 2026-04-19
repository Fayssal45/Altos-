import { createServerSupabaseClient } from "@/lib/supabase/server";
import BusinessProfileForm from "@/components/profile/BusinessProfileForm";

export default async function EntreprisePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .maybeSingle();

  return <BusinessProfileForm business={business} userId={session!.user.id} />;
}
