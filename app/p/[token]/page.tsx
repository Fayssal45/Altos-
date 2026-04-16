import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ClientEstimateView from "@/components/estimates/ClientEstimateView";
import { headers } from "next/headers";

export default async function PublicEstimatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  // Récupération du devis via le share_token (accès public)
  const { data: estimate } = await admin
    .from("estimates")
    .select("*, client:clients(*), items:estimate_items(*, sort_order), business:businesses(*)")
    .eq("share_token", token)
    .not("status", "eq", "archived")
    .single();

  if (!estimate) notFound();

  // Tracker l'ouverture (idempotent pour le 1er open)
  if (!estimate.viewed_at) {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    await admin
      .from("estimates")
      .update({
        status: estimate.status === "sent" ? "viewed" : estimate.status,
        viewed_at: new Date().toISOString(),
        viewed_count: (estimate.viewed_count || 0) + 1,
      })
      .eq("id", estimate.id);
  } else {
    // Incrémenter le compteur
    await admin
      .from("estimates")
      .update({ viewed_count: (estimate.viewed_count || 0) + 1 })
      .eq("id", estimate.id);
  }

  // Trier les items
  const sortedItems = [...(estimate.items || [])].sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);

  return (
    <ClientEstimateView
      estimate={{ ...estimate, items: sortedItems }}
    />
  );
}
