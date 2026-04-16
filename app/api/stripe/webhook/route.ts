import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const estimateId = paymentIntent.metadata?.estimate_id;

    if (estimateId) {
      await admin
        .from("estimates")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", estimateId);

      // Notifier via reminder (l'artisan verra ça dans le dashboard)
      const { data: estimate } = await admin
        .from("estimates")
        .select("business_id, client_id, number, title")
        .eq("id", estimateId)
        .single();

      if (estimate) {
        await admin.from("reminders").insert({
          business_id: estimate.business_id,
          estimate_id: estimateId,
          client_id: estimate.client_id,
          type: "custom",
          status: "pending",
          message: `✅ Paiement reçu pour ${estimate.number} – ${estimate.title || ""}. Montant : ${(paymentIntent.amount / 100).toFixed(2)} €`,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
