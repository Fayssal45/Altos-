import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import SWRProvider from "@/components/providers/SWRProvider";
import { AppModeProvider } from "@/contexts/AppModeContext";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();

  // getSession() — reads JWT from cookie, zero Supabase network call.
  // Middleware already ran getSession() and would have redirected if invalid.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Business first — needed as key for all subsequent queries.
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session.user.id)
    .single();

  let relancesCount = 0;
  let estimatesData: unknown[] = [];
  let clientsData: unknown[] = [];

  if (business?.id) {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const bid = business.id;

    // All 4 queries run in parallel — no sequential waiting.
    // estimates + clients seed the SWR client-side cache so tab pages render instantly.
    const [
      { count: pendingCount },
      { count: viewedCount },
      { data: estimates },
      { data: clients },
    ] = await Promise.all([
      supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
        .eq("status", "pending"),
      supabase
        .from("estimates")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
        .eq("status", "viewed")
        .lt("viewed_at", fortyEightHoursAgo),
      supabase
        .from("estimates")
        .select("*, client:clients(full_name, phone, company_name, address, city, postal_code)")
        .eq("business_id", bid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("clients")
        .select("*")
        .eq("business_id", bid)
        .order("full_name"),
    ]);

    relancesCount = (pendingCount || 0) + (viewedCount || 0);
    estimatesData = estimates ?? [];
    clientsData = clients ?? [];
  }

  // SWR fallback: pre-seeds client cache so EstimateList & ClientList render
  // instantly without a loading state on first visit to each tab.
  const swrFallback: Record<string, unknown> = {
    [`estimates-list:${business?.id}`]: estimatesData,
    [`clients-list:${business?.id}`]: clientsData,
  };

  return (
    <SWRProvider fallback={swrFallback}>
      <AppModeProvider>
        <AppShell
          business={business}
          user={session.user}
          relancesCount={relancesCount}
        >
          {children}
        </AppShell>
      </AppModeProvider>
    </SWRProvider>
  );
}
