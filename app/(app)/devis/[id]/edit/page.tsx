import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EstimateForm from "@/components/estimates/EstimateForm";
import EstimateDetailView from "@/components/estimates/EstimateDetailView";

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session!.user.id)
    .single();

  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, client:clients(*), items:estimate_items(*)")
    .eq("id", id)
    .eq("business_id", business?.id || "")
    .single();

  const { data: attachments } = await supabase
    .from("estimate_attachments")
    .select("*")
    .eq("estimate_id", id)
    .order("sort_order");

  if (!estimate) notFound();

  // Si devis accepté ou payé → vue lecture seule
  if (["accepted", "paid", "archived"].includes(estimate.status)) {
    return <EstimateDetailView estimate={estimate} business={business} />;
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, company_name, phone, email, address")
    .eq("business_id", business?.id || "")
    .order("full_name");

  // Trier les items
  const sortedItems = [...(estimate.items || [])].sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);

  return (
    <EstimateForm
      business={business}
      clients={(clients || []) as any}
      mode="edit"
      estimate={{ ...estimate, items: sortedItems }}
      existingAttachments={(attachments || []) as any}
    />
  );
}
