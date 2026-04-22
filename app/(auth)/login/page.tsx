"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";

// ─── Google SVG ───────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span className={`w-4 h-4 border-2 rounded-full animate-spin ${
      light ? "border-white/30 border-t-white" : "border-slate-300 border-t-slate-600"
    }`} />
  );
}

// ─── Input field ─────────────────────────────────────────────────────────────
function Field({
  label, type = "text", value, onChange, placeholder, icon, autoComplete, required, minLength,
  right,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3.5 text-slate-400 pointer-events-none">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={`w-full h-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors ${icon ? "pl-10" : "pl-4"} ${right ? "pr-12" : "pr-4"}`}
        />
        {right && (
          <span className="absolute right-3.5">{right}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Compte créé ! Vérifiez votre email pour confirmer.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      if (msg === "Invalid login credentials") {
        toast.error("Email ou mot de passe incorrect");
      } else if (msg.includes("Email not confirmed")) {
        toast.error("Confirmez votre email avant de vous connecter");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch {
      toast.error("Impossible de se connecter avec Google");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 bg-slate-50">

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Image
            src="/logo-full.svg"
            alt="Altos"
            width={200}
            height={150}
            className="h-36 w-auto"
            priority
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-100 overflow-hidden">

          {/* Mode tabs */}
          <div className="flex border-b border-slate-100">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-4 text-sm font-bold transition-colors ${
                  mode === m
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {m === "login" ? "Connexion" : "Créer un compte"}
              </button>
            ))}
          </div>

          <div className="p-6 flex flex-col gap-5">

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full h-12 flex items-center justify-center gap-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-60"
            >
              {googleLoading ? <Spinner /> : <GoogleIcon />}
              {googleLoading ? "Connexion…" : "Continuer avec Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">ou par email</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === "signup" && (
                <Field
                  label="Nom complet"
                  value={name}
                  onChange={setName}
                  placeholder="Jean Dupont"
                  icon={<User className="w-4 h-4" />}
                  autoComplete="name"
                  required
                />
              )}

              <Field
                label="Adresse email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="jean@exemple.fr"
                icon={<Mail className="w-4 h-4" />}
                autoComplete={mode === "login" ? "username email" : "email"}
                required
              />

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mot de passe</label>
                  {mode === "login" && (
                    <Link
                      href="/auth/reset-password"
                      className="text-xs text-blue-600 font-semibold hover:text-blue-700"
                    >
                      Mot de passe oublié ?
                    </Link>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                    className="w-full h-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors pl-10 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === "signup" && (
                  <p className="text-[11px] text-slate-400 ml-1">Minimum 8 caractères</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-13 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-base transition-colors disabled:opacity-70 mt-1"
                style={{ height: "52px" }}
              >
                {loading ? <Spinner light /> : null}
                {loading
                  ? (mode === "login" ? "Connexion…" : "Création…")
                  : (mode === "login" ? "Se connecter" : "Créer mon compte")}
              </button>
            </form>

            {/* Passkey placeholder — future feature */}
            {/* TODO: implement passkey / biometric auth
              navigator.credentials.create({ publicKey: ... })
              navigator.credentials.get({ publicKey: ... })
              Feature flags: window.PublicKeyCredential available
            */}

          </div>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Essai gratuit 14 jours · Aucune CB requise
        </p>
      </div>
    </div>
  );
}
