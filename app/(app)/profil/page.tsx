import { createServerSupabaseClient } from "@/lib/supabase/server";
import ProfilView from "@/components/profile/ProfilView";

export default async function ProfilPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const [{ data: business }, { data: profile }] = await Promise.all([
    supabase.from("businesses").select("*").eq("owner_id", session!.user.id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", session!.user.id).maybeSingle(),
  ]);

  return <ProfilView business={business} profile={profile} email={session!.user.email || ""} />;
}
