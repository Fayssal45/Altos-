import { createServerSupabaseClient } from "@/lib/supabase/server";
import ClientForm from "@/components/clients/ClientForm";
import Link from "next/link";

export default async function NouveauClientPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  if (!business?.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          <span className="text-3xl">🏢</span>
        </div>
        <h1 className="text-xl font-black text-slate-900">Configurez votre entreprise d'abord</h1>
        <p className="text-slate-500 text-sm">Vous devez renseigner votre entreprise avant de créer des clients.</p>
        <Link
          href="/profil/entreprise"
          className="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl"
        >
          Configurer mon entreprise
        </Link>
      </div>
    );
  }

  return <ClientForm businessId={business.id} mode="create" />;
}
