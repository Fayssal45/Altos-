import { createServerSupabaseClient } from "@/lib/supabase/server";
import DocumentsView from "@/components/documents/DocumentsView";
import { redirect } from "next/navigation";

export default async function DocumentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", session.user.id)
    .single();

  const { data: documents } = business
    ? await supabase
        .from("business_documents")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <DocumentsView
      businessId={business?.id || ""}
      initialDocuments={documents || []}
    />
  );
}
