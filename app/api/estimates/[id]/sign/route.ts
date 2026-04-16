import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { signature_svg, signed_by_name, share_token } = body;

    if (!signature_svg || !signed_by_name || !share_token) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Vérifie que le share_token correspond bien à cet estimate
    const { data: estimate } = await admin
      .from("estimates")
      .select("id, share_token, status, business_id")
      .eq("id", id)
      .eq("share_token", share_token)
      .single();

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    if (["paid", "accepted", "archived"].includes(estimate.status)) {
      return NextResponse.json({ error: "Estimate already signed" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    // Mise à jour avec signature
    const { error } = await admin
      .from("estimates")
      .update({
        status: "accepted",
        signed_at: new Date().toISOString(),
        signature_svg,
        signed_by_name,
        signed_by_ip: ip,
      })
      .eq("id", id);

    if (error) throw error;

    // Créer une relance de paiement si pas de lien Stripe
    const { data: business } = await admin
      .from("businesses")
      .select("id")
      .eq("id", estimate.business_id)
      .single();

    if (business) {
      await admin.from("reminders").insert({
        business_id: business.id,
        estimate_id: id,
        type: "unpaid",
        status: "pending",
        message: `Le devis a été signé par ${signed_by_name}. Pensez à envoyer le lien de paiement.`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Sign estimate error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
