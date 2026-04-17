import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Charge le business de l'utilisateur
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  // Badge relances : reminders pending + devis vus non signés depuis 48h
  let relancesCount = 0;
  if (business?.id) {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const [{ count: pendingCount }, { count: viewedCount }] = await Promise.all([
      supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("status", "pending"),
      supabase
        .from("estimates")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("status", "viewed")
        .lt("viewed_at", fortyEightHoursAgo),
    ]);
    relancesCount = (pendingCount || 0) + (viewedCount || 0);
  }

  return <AppShell business={business} user={user} relancesCount={relancesCount}>{children}</AppShell>;
}
