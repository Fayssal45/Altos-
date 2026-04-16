import { createServerSupabaseClient } from "@/lib/supabase/server";
import ProfilView from "@/components/profile/ProfilView";

export default async function ProfilPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: business }, { data: profile }] = await Promise.all([
    supabase.from("businesses").select("*").eq("owner_id", user!.id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
  ]);

  return <ProfilView business={business} profile={profile} email={user!.email || ""} />;
}
