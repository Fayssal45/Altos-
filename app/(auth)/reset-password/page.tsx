"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Zap, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500 shadow-2xl shadow-blue-500/40 mb-4">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Mot de passe oublié</h1>
          <p className="text-blue-200/70 text-sm mt-1.5">
            {sent ? "Email envoyé !" : "Nous vous enverrons un lien de réinitialisation"}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl shadow-black/30 p-6">
          {sent ? (
            // Success state
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Email envoyé !</p>
                <p className="text-sm text-slate-500 mt-1">
                  Consultez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Envoyé à <span className="font-semibold">{email}</span>
                </p>
              </div>
              <Link
                href="/login"
                className="w-full h-12 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold rounded-xl text-sm mt-2"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            // Form state
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Adresse email
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean@exemple.fr"
                    autoComplete="email"
                    required
                    className="w-full h-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors pl-10 pr-4"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-base transition-colors disabled:opacity-70"
                style={{ height: "52px" }}
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium py-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
