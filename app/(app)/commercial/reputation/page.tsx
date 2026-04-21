import { createServerSupabaseClient } from "@/lib/supabase/server";
import ReputationView from "@/components/commercial/ReputationView";

export default async function ReputationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .single();

  const bid = business?.id ?? "";

  const [{ data: clients }, { data: requests }] = await Promise.all([
    supabase.from("clients").select("*").eq("business_id", bid).order("full_name"),
    supabase.from("review_requests")
      .select("*, client:clients(full_name, phone)")
      .eq("business_id", bid)
      .order("sent_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <ReputationView
      business={business!}
      clients={clients ?? []}
      requests={(requests ?? []) as any}
    />
  );
}
