"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import type { Business } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import {
  Home, FileText, Users, Calendar, Bell,
  Plus, X, Zap, Briefcase, Camera,
  Paperclip, AlertTriangle, CheckCircle2, Clock, ChevronRight,
  ScanLine, Settings, BookOpen, BarChart2, TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { useAppMode } from "@/contexts/AppModeContext";

// ─── Nav definitions ──────────────────────────────────────────────────────────

type NavItem = { href: string; icon: React.ElementType; label: string };

// ── TERRAIN: Agir vite, en déplacement ───────────────────────────────────────
// Home = vue du jour · Clients = accès rapide · Planning = secondaire ·
// Devis = suivi rapide des devis en attente de signature
const TERRAIN_LEFT: NavItem[] = [
  { href: "/terrain",  icon: Home,     label: "Accueil"  },
  { href: "/clients",  icon: Users,    label: "Clients"  },
];
const TERRAIN_RIGHT: NavItem[] = [
  { href: "/planning", icon: Calendar, label: "Planning" },
  { href: "/devis",    icon: FileText, label: "Devis"    },
];

// ── ADMIN: Gérer, piloter, ranger ────────────────────────────────────────────
// Home = /terrain (blocs admin) · Devis = suivi complet · Clients = gestion ·
// Finances = CA / paiements / export
const ADMIN_LEFT: NavItem[] = [
  { href: "/terrain",   icon: Home,        label: "Accueil"  },
  { href: "/devis",     icon: FileText,    label: "Devis"    },
];
const ADMIN_RIGHT: NavItem[] = [
  { href: "/clients",   icon: Users,       label: "Clients"  },
  { href: "/revenus",   icon: TrendingUp,  label: "Finances" },
];

// All tab roots from both modes — kept mounted after first visit
// /terrain is shared home; /dashboard is accessible but not a primary tab
const ALL_TAB_PATHS = ["/terrain", "/planning", "/devis", "/clients", "/revenus"];

// ─── FAB definitions ──────────────────────────────────────────────────────────

type FabAction = {
  label: string;
  icon: React.ElementType;
  color: string;
  shadow: string;
  href?: string;
  action?: "camera";
};

// Terrain FAB: actions terrain — rapides, contextuelles, sur le chantier
const TERRAIN_FAB: FabAction[] = [
  { label: "Intervention rapide", icon: Zap,      color: "bg-amber-500",   shadow: "shadow-amber-500/40",   href: "/interventions/nouveau" },
  { label: "Devis rapide",        icon: FileText, color: "bg-blue-600",    shadow: "shadow-blue-600/40",    href: "/devis/nouveau"         },
  { label: "Catalogue prestations",icon: BookOpen,color: "bg-violet-600",  shadow: "shadow-violet-600/40",  href: "/catalogue"             },
  { label: "Prendre une photo",   icon: Camera,   color: "bg-pink-500",    shadow: "shadow-pink-500/40",    action: "camera"               },
];

// Admin FAB: actions de gestion — créer, relancer, exporter
const ADMIN_FAB: FabAction[] = [
  { label: "Nouveau Devis",     icon: FileText,  color: "bg-blue-600",    shadow: "shadow-blue-600/40",    href: "/devis/nouveau"      },
  { label: "Nouveau Client",    icon: Users,     color: "bg-emerald-600", shadow: "shadow-emerald-600/40", href: "/clients/nouveau"    },
  { label: "Relances",          icon: Bell,      color: "bg-orange-500",  shadow: "shadow-orange-500/40",  href: "/relances"           },
  { label: "Mes documents",     icon: ScanLine,  color: "bg-slate-700",   shadow: "shadow-slate-700/40",   href: "/documents"          },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
  business: Business | null;
  user: User;
  relancesCount?: number;
}

export default function AppShell({ children, business, user, relancesCount = 0 }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [fabOpen, setFabOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { mode, switchMode, hydrated } = useAppMode(pathname);

  const navLeft    = mode === "terrain" ? TERRAIN_LEFT  : ADMIN_LEFT;
  const navRight   = mode === "terrain" ? TERRAIN_RIGHT : ADMIN_RIGHT;
  const fabActions = mode === "terrain" ? TERRAIN_FAB   : ADMIN_FAB;

  // SPA-like tab cache: keeps all visited tabs mounted in the DOM so
  // switching back is instant — no re-mount, no loading state.
  const [tabCache, setTabCache] = useState<Record<string, React.ReactNode>>({});
  const isTabPath = ALL_TAB_PATHS.includes(pathname);

  useEffect(() => {
    if (isTabPath) {
      setTabCache((prev) => ({ ...prev, [pathname]: children }));
    }
  }, [pathname, children, isTabPath]);

  const { data: notifications } = useNotifications(business?.id);

  // Prefetch all routes from both modes at mount for instant first tap.
  useEffect(() => {
    ["/terrain", "/dashboard", "/planning", "/devis", "/clients", "/relances", "/revenus", "/catalogue"].forEach(
      (r) => router.prefetch(r)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgentCount = (notifications || []).filter((n) => n.category === "urgent").length;
  const notifTotal  = (notifications || []).length;
  const initial     = (business?.name || user.email || "U")[0].toUpperCase();

  // Switch mode in place — blocks on the current page adapt.
  // Navigate to /terrain (shared home) only when currently on a mode-exclusive page.
  const handleSwitchMode = (newMode: "terrain" | "admin") => {
    switchMode(newMode);
    // If currently on a page that belongs only to the other mode, go to shared home
    const adminOnly = ["/dashboard", "/revenus"];
    const terrainOnly = ["/planning", "/catalogue"];
    if (newMode === "terrain" && adminOnly.includes(pathname)) {
      router.push("/terrain");
    } else if (newMode === "admin" && terrainOnly.includes(pathname)) {
      router.push("/terrain");
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCapturedPhoto(url);
    setFabOpen(false);
    e.target.value = "";
  };

  const handlePhotoAction = (action: "intervention" | "new-intervention" | "new-devis") => {
    setCapturedPhoto(null);
    if (action === "new-intervention") router.push("/chantiers/nouveau");
    else if (action === "new-devis")   router.push("/devis/nouveau");
    else                               router.push("/chantiers");
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">

          {/* Logo + business name */}
          <Link
            href="/terrain"
            className="flex items-center gap-2 flex-shrink-0 min-w-0"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
              {business?.logo_url ? (
                <img src={business.logo_url} alt={business.name || "Logo"} className="w-full h-full object-contain" />
              ) : (
                <Image src="/logo.svg" alt="Altos" width={32} height={32} className="object-contain" />
              )}
            </div>
            <p className="text-[13px] font-black text-slate-900 leading-none truncate max-w-[72px]">
              {business?.name || "Altos"}
            </p>
          </Link>

          {/* Mode toggle — centered, flex-1 */}
          <div className={cn(
            "flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 flex-1 transition-opacity",
            !hydrated && "opacity-0 pointer-events-none"
          )}>
            <button
              onClick={() => handleSwitchMode("terrain")}
              className={cn(
                "flex items-center justify-center gap-1 flex-1 py-1 rounded-md text-[11px] font-bold transition-all",
                mode === "terrain"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-400 active:text-slate-600"
              )}
            >
              <Zap className="w-3 h-3" />
              Terrain
            </button>
            <button
              onClick={() => handleSwitchMode("admin")}
              className={cn(
                "flex items-center justify-center gap-1 flex-1 py-1 rounded-md text-[11px] font-bold transition-all",
                mode === "admin"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-400 active:text-slate-600"
              )}
            >
              <BarChart2 className="w-3 h-3" />
              Admin
            </button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setNotifOpen(true)}
              className="relative w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              {notifTotal > 0 && (
                <span className={cn(
                  "absolute -top-0.5 -right-0.5 min-w-[15px] h-3.5 rounded-full flex items-center justify-center text-[8px] font-black text-white px-1",
                  urgentCount > 0 ? "bg-red-500" : "bg-blue-500"
                )}>
                  {notifTotal > 9 ? "9+" : notifTotal}
                </span>
              )}
            </button>
            <Link
              href="/profil/entreprise"
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"
              aria-label="Paramètres"
            >
              <Settings className="w-4 h-4 text-slate-600" />
            </Link>
            <Link
              href="/profil"
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
            >
              {initial}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main content — SPA tab cache ────────────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden">
        {Object.entries(tabCache).map(([path, content]) => (
          <div
            key={path}
            className={`absolute inset-0 overflow-y-auto pb-24 ${path === pathname ? "" : "hidden"}`}
            aria-hidden={path !== pathname}
          >
            {content}
          </div>
        ))}
        {(!isTabPath || !tabCache[pathname]) && (
          <div className="absolute inset-0 overflow-y-auto pb-24">
            {children}
          </div>
        )}
      </main>

      {/* ── FAB overlay ─────────────────────────────────────────────────────── */}
      {fabOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setFabOpen(false)} />
      )}

      {/* ── FAB actions (mode-specific) ──────────────────────────────────────── */}
      {fabOpen && (
        <div className="fixed bottom-[88px] right-4 z-50 flex flex-col gap-2.5 items-end">
          {fabActions.map((fab, i) => (
            <button
              key={i}
              onClick={() => {
                if (fab.action === "camera") {
                  cameraInputRef.current?.click();
                } else if (fab.href) {
                  router.push(fab.href);
                  setFabOpen(false);
                }
              }}
              className="flex items-center gap-3 animate-slide-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="bg-white rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-lg border border-slate-100">
                {fab.label}
              </span>
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0",
                fab.color, fab.shadow
              )}>
                <fab.icon className="w-5 h-5 text-white" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Hidden camera input ──────────────────────────────────────────────── */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {/* ── Photo capture bottom sheet ──────────────────────────────────────── */}
      {capturedPhoto && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setCapturedPhoto(null)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 mb-4">
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedPhoto} alt="Photo prise" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="px-4 pb-2">
              <p className="text-sm font-bold text-slate-700 mb-3 text-center">Que faire avec cette photo ?</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handlePhotoAction("intervention")}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-violet-50 active:bg-violet-100"
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0">
                    <Paperclip className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Attacher à une intervention</p>
                    <p className="text-xs text-slate-500">Choisir une intervention existante</p>
                  </div>
                </button>
                <button
                  onClick={() => handlePhotoAction("new-intervention")}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 active:bg-amber-100"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Créer une intervention</p>
                    <p className="text-xs text-slate-500">Nouvelle intervention avec cette photo</p>
                  </div>
                </button>
                <button
                  onClick={() => handlePhotoAction("new-devis")}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-blue-50 active:bg-blue-100"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Créer un devis</p>
                    <p className="text-xs text-slate-500">Nouveau devis avec cette photo</p>
                  </div>
                </button>
                <button
                  onClick={() => { setCapturedPhoto(null); router.push("/documents"); }}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <ScanLine className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Enregistrer dans Mes documents</p>
                    <p className="text-xs text-slate-500">Ticket, facture, scan de document</p>
                  </div>
                </button>
                <button
                  onClick={() => setCapturedPhoto(null)}
                  className="flex items-center justify-center px-4 py-3.5 rounded-2xl bg-slate-100 active:bg-slate-200 mt-1"
                >
                  <X className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-sm font-semibold text-slate-500">Annuler</span>
                </button>
              </div>
            </div>
            <div className="pb-safe h-4" />
          </div>
        </>
      )}

      {/* ── Notification center ──────────────────────────────────────────────── */}
      {notifOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setNotifOpen(false)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 flex-shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-black text-slate-900">Notifications</h2>
              <button onClick={() => setNotifOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 pb-safe">
              {(!notifications || notifications.length === 0) ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-1">
                    <Bell className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Aucune notification</p>
                  <p className="text-xs text-slate-400">Vous êtes à jour !</p>
                </div>
              ) : (
                <NotifSection
                  icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                  label="Urgent" color="text-red-600"
                  items={(notifications || []).filter((n) => n.category === "urgent")}
                  onClose={() => setNotifOpen(false)}
                />
              )}
              {notifications && notifications.filter((n) => n.category === "today").length > 0 && (
                <NotifSection
                  icon={<Clock className="w-3.5 h-3.5 text-blue-500" />}
                  label="Aujourd'hui" color="text-blue-600"
                  items={notifications.filter((n) => n.category === "today")}
                  onClose={() => setNotifOpen(false)}
                />
              )}
              {notifications && notifications.filter((n) => n.category === "admin").length > 0 && (
                <NotifSection
                  icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  label="À traiter" color="text-emerald-600"
                  items={notifications.filter((n) => n.category === "admin")}
                  onClose={() => setNotifOpen(false)}
                />
              )}
              <div className="h-4" />
            </div>
          </div>
        </>
      )}

      {/* ── Bottom nav: 2 tabs | FAB | 2 tabs ───────────────────────────────── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 bg-white border-t border-slate-100 pb-safe">
        <div className="flex items-center px-1 py-1.5">
          {navLeft.map((item) => (
            <NavTab key={item.href} item={item} pathname={pathname} relancesCount={relancesCount} />
          ))}

          {/* FAB */}
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className={cn(
              "w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-200 flex-shrink-0 mx-1",
              fabOpen ? "bg-slate-800" : "bg-blue-600 shadow-blue-600/40"
            )}
            aria-label="Actions rapides"
          >
            <Plus className={cn("w-6 h-6 text-white transition-transform duration-200", fabOpen && "rotate-45")} />
          </button>

          {navRight.map((item) => (
            <NavTab key={item.href} item={item} pathname={pathname} relancesCount={relancesCount} />
          ))}
        </div>
      </nav>
    </div>
  );
}

// ─── NavTab ───────────────────────────────────────────────────────────────────

function NavTab({
  item, pathname, relancesCount,
}: {
  item: NavItem;
  pathname: string;
  relancesCount: number;
}) {
  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard" || pathname === "/"
      : pathname.startsWith(item.href);
  const badge = item.href === "/relances" && relancesCount > 0 ? relancesCount : 0;

  return (
    <Link
      href={item.href}
      prefetch={true}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors",
        isActive ? "text-blue-600" : "text-slate-400"
      )}
    >
      <item.icon className={cn("w-5 h-5 transition-all", isActive ? "stroke-[2.5]" : "stroke-2")} />
      <span className="text-[9px] font-bold tracking-wide">{item.label}</span>
      {badge > 0 && (
        <span className="absolute top-1 right-2.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

// ─── NotifSection ─────────────────────────────────────────────────────────────

function NotifSection({
  icon, label, color, items, onClose,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  items: AppNotification[];
  onClose: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="px-4 pt-4">
      <div className={cn("flex items-center gap-1.5 mb-2", color)}>
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="text-xs font-bold ml-1 opacity-60">({items.length})</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((n) => (
          <Link
            key={n.id}
            href={n.href}
            onClick={onClose}
            className="flex items-start gap-3 bg-slate-50 rounded-xl px-3.5 py-3 active:bg-slate-100"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-snug">{n.title}</p>
              {n.subtitle && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{n.subtitle}</p>
              )}
              {n.timestamp && (
                <p className="text-[10px] text-slate-300 mt-0.5">{formatDate(n.timestamp)}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
