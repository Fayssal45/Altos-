import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CatalogView from "@/components/catalogue/CatalogView";

export default async function CataloguePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session.user.id)
    .single();

  const { data: items } = await supabase
    .from("library_items")
    .select("*")
    .eq("business_id", business?.id || "")
    .order("usage_count", { ascending: false })
    .order("description");

  return <CatalogView business={business} initialItems={items || []} />;
}
