"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Building2, ChevronRight, LogOut, Settings,
  FileText, CreditCard, HelpCircle, Bell
} from "lucide-react";
import type { Business, Profile } from "@/lib/types";
import toast from "react-hot-toast";

interface ProfilViewProps {
  business: Business | null;
  profile: Profile | null;
  email: string;
}

export default function ProfilView({ business, profile, email }: ProfilViewProps) {
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const MENU_SECTIONS = [
    {
      title: "Mon Entreprise",
      items: [
        { icon: Building2, label: "Infos & Logo", href: "/profil/entreprise" },
        { icon: CreditCard, label: "Paiement & IBAN", href: "/profil/entreprise" },
      ],
    },
    {
      title: "Application",
      items: [
        { icon: Bell, label: "Notifications", href: "/profil/notifications" },
        { icon: HelpCircle, label: "Aide & Support", href: "/profil/aide" },
        { icon: FileText, label: "CGU & Confidentialité", href: "/profil/cgu" },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-black text-slate-900">Profil</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4">
        {/* Avatar + infos */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-2xl font-black">
              {(business?.name || profile?.full_name || email)[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-slate-900 truncate">
              {business?.name || profile?.full_name || "Mon Entreprise"}
            </p>
            {business?.activity && (
              <p className="text-sm text-blue-600 font-semibold">{business.activity}</p>
            )}
            <p className="text-sm text-slate-400 truncate">{email}</p>
          </div>
        </div>

        {!business && (
          <Link
            href="/profil/entreprise"
            className="flex items-center gap-3 bg-blue-600 rounded-2xl p-4 text-white"
          >
            <Building2 className="w-5 h-5" />
            <div>
              <p className="font-bold">Configurer mon entreprise</p>
              <p className="text-xs text-blue-200">Nom, SIRET, logo…</p>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto" />
          </Link>
        )}

        {MENU_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{section.title}</h2>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {section.items.map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-4 active:bg-slate-50 ${
                    i < section.items.length - 1 ? "border-b border-slate-50" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-slate-600" />
                  </div>
                  <span className="flex-1 text-base font-medium text-slate-800">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* Déconnexion */}
        <button
          onClick={logout}
          className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4 text-red-600 w-full"
        >
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-base font-semibold">Se déconnecter</span>
        </button>

        <p className="text-center text-xs text-slate-300 pb-4">Altos v1.0.0 · Artisan Pro</p>
      </div>
    </div>
  );
}
