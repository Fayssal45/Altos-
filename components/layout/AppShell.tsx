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
  Star, MessageCircle, Eye,
} from "lucide-react";
import Image from "next/image";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { useAppMode, type AppMode } from "@/contexts/AppModeContext";
import OfflineBanner from "@/components/ui/OfflineBanner";

// ─── Nav definitions ──────────────────────────────────────────────────────────

type NavItem = { href: string; icon: React.ElementType; label: string };

// ── TERRAIN ──────────────────────────────────────────────────────────────────
const TERRAIN_LEFT: NavItem[]  = [
  { href: "/terrain",  icon: Home,     label: "Accueil"  },
  { href: "/clients",  icon: Users,    label: "Clients"  },
];
const TERRAIN_RIGHT: NavItem[] = [
  { href: "/planning", icon: Calendar, label: "Planning" },
  { href: "/devis",    icon: FileText, label: "Devis"    },
];

// ── ADMIN ────────────────────────────────────────────────────────────────────
const ADMIN_LEFT: NavItem[] = [
  { href: "/terrain",  icon: Home,       label: "Accueil"  },
  { href: "/devis",    icon: FileText,   label: "Devis"    },
];
const ADMIN_RIGHT: NavItem[] = [
  { href: "/clients",  icon: Users,      label: "Clients"  },
  { href: "/revenus",  icon: TrendingUp, label: "Finances" },
];

// ── COMMERCIAL ───────────────────────────────────────────────────────────────
const COMMERCIAL_LEFT: NavItem[] = [
  { href: "/commercial",                  icon: Home,           label: "Accueil"   },
  { href: "/commercial/chantiers",        icon: Camera,         label: "Avant/Après"},
];
const COMMERCIAL_RIGHT: NavItem[] = [
  { href: "/commercial/relances-clarte",  icon: MessageCircle,  label: "Relances"  },
  { href: "/commercial/reputation",       icon: Star,           label: "Avis"      },
];

// All tab roots — kept mounted after first visit (SPA cache)
const ALL_TAB_PATHS = [
  "/terrain", "/planning", "/devis", "/clients", "/revenus",
  "/commercial",
];

// ─── FAB definitions ──────────────────────────────────────────────────────────

type FabAction = {
  label: string;
  icon: React.ElementType;
  color: string;
  shadow: string;
  href?: string;
  action?: "camera";
};

const TERRAIN_FAB: FabAction[] = [
  { label: "Intervention rapide",   icon: Zap,       color: "bg-amber-500",   shadow: "shadow-amber-500/40",   href: "/interventions/nouveau" },
  { label: "Devis rapide",          icon: FileText,  color: "bg-blue-600",    shadow: "shadow-blue-600/40",    href: "/devis/nouveau"         },
  { label: "Catalogue prestations", icon: BookOpen,  color: "bg-violet-600",  shadow: "shadow-violet-600/40",  href: "/catalogue"             },
  { label: "Prendre une photo",     icon: Camera,    color: "bg-pink-500",    shadow: "shadow-pink-500/40",    action: "camera"               },
];

const ADMIN_FAB: FabAction[] = [
  { label: "Nouveau Devis",    icon: FileText,  color: "bg-blue-600",    shadow: "shadow-blue-600/40",    href: "/devis/nouveau"    },
  { label: "Nouveau Client",   icon: Users,     color: "bg-emerald-600", shadow: "shadow-emerald-600/40", href: "/clients/nouveau"  },
  { label: "Relances",         icon: Bell,      color: "bg-orange-500",  shadow: "shadow-orange-500/40",  href: "/relances"         },
  { label: "Mes documents",    icon: ScanLine,  color: "bg-slate-700",   shadow: "shadow-slate-700/40",   href: "/documents"        },
];

const COMMERCIAL_FAB: FabAction[] = [
  { label: "Nouveau chantier",   icon: Camera,         color: "bg-pink-600",   shadow: "shadow-pink-600/40",   href: "/commercial/chantiers"       },
  { label: "Demander un avis",   icon: Star,           color: "bg-amber-500",  shadow: "shadow-amber-500/40",  href: "/commercial/reputation"      },
  { label: "Envoyer campagne",   icon: MessageCircle,  color: "bg-orange-500", shadow: "shadow-orange-500/40", href: "/commercial/relances-clarte" },
  { label: "Radar visibilité",   icon: Eye,            color: "bg-violet-600", shadow: "shadow-violet-600/40", href: "/commercial/radar"           },
];

// ─── Mode config ──────────────────────────────────────────────────────────────

const MODE_CONFIG = {
  terrain: {
    label: "Terrain",
    icon: Zap,
    color: "text-amber-600",
    bg: "bg-amber-600",
    fabColor: "bg-blue-600 shadow-blue-600/40",
    left: TERRAIN_LEFT, right: TERRAIN_RIGHT, fab: TERRAIN_FAB,
    homeHref: "/terrain",
  },
  admin: {
    label: "Admin",
    icon: BarChart2,
    color: "text-blue-600",
    bg: "bg-blue-600",
    fabColor: "bg-blue-600 shadow-blue-600/40",
    left: ADMIN_LEFT, right: ADMIN_RIGHT, fab: ADMIN_FAB,
    homeHref: "/terrain",
  },
  commercial: {
    label: "Commercial",
    icon: TrendingUp,
    color: "text-violet-600",
    bg: "bg-violet-600",
    fabColor: "bg-violet-600 shadow-violet-600/40",
    left: COMMERCIAL_LEFT, right: COMMERCIAL_RIGHT, fab: COMMERCIAL_FAB,
    homeHref: "/commercial",
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
  business: Business | null;
  user: User;
  relancesCount?: number;
}

export default function AppShell({ children, business, user, relancesCount = 0 }: AppShellProps) {
  const pathname = usePathname();
  const router   = useRouter();

  const [fabOpen, setFabOpen]         = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [modeAnim, setModeAnim]       = useState<"right" | "left" | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { mode, switchMode, hydrated } = useAppMode();
  const cfg = MODE_CONFIG[mode];

  const MODE_ORDER: AppMode[] = ["terrain", "admin", "commercial"];

  const navLeft    = cfg.left;
  const navRight   = cfg.right;
  const fabActions = cfg.fab;

  const [tabCache, setTabCache] = useState<Record<string, React.ReactNode>>({});
  const isTabPath = ALL_TAB_PATHS.includes(pathname);

  useEffect(() => {
    if (isTabPath) {
      setTabCache((prev) => ({ ...prev, [pathname]: children }));
    }
  }, [pathname, children, isTabPath]);

  const { data: notifications } = useNotifications(business?.id);

  // Prefetch all primary routes on mount
  useEffect(() => {
    [
      "/terrain", "/dashboard", "/planning", "/devis", "/clients",
      "/relances", "/revenus", "/catalogue", "/commercial",
    ].forEach((r) => router.prefetch(r));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgentCount = (notifications || []).filter((n) => n.category === "urgent").length;
  const notifTotal  = (notifications || []).length;
  const initial     = (business?.name || user.email || "U")[0].toUpperCase();

  const handleSwitchMode = (newMode: AppMode) => {
    if (newMode === mode) return;
    // Determine animation direction
    const from = MODE_ORDER.indexOf(mode);
    const to   = MODE_ORDER.indexOf(newMode);
    setModeAnim(to > from ? "right" : "left");
    setTimeout(() => setModeAnim(null), 250);
    switchMode(newMode);

    const isOnCommercial  = pathname === "/commercial" || pathname.startsWith("/commercial/");
    const isOnAdminOnly   = ["/dashboard", "/revenus"].includes(pathname);
    const isOnTerrainOnly = ["/planning", "/catalogue"].includes(pathname);

    if (newMode === "commercial") {
      // Always navigate to commercial hub when switching to commercial
      router.push("/commercial");
    } else if (newMode === "terrain") {
      if (isOnCommercial || isOnAdminOnly) router.push("/terrain");
    } else if (newMode === "admin") {
      if (isOnCommercial || isOnTerrainOnly) router.push("/terrain");
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedPhoto(URL.createObjectURL(file));
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
      <OfflineBanner />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HEADER — 2 rows                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">

        {/* ── Row 1: Logo · Business name · Notifications · Avatar ─────────── */}
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
          <Link
            href={cfg.homeHref}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            {business?.logo_url ? (
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100">
                <img src={business.logo_url} alt={business.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <Image
                src="/logo.svg"
                alt="Altos"
                width={90}
                height={32}
                className="h-7 w-auto flex-shrink-0"
                priority
              />
            )}
            {business?.name && (
              <span className="text-sm font-bold text-slate-700 truncate leading-none">
                {business.name}
              </span>
            )}
          </Link>

          {/* Right icons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setNotifOpen(true)}
              className="relative w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200"
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
              href="/profil"
              className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xs flex-shrink-0"
              aria-label="Mon profil"
            >
              {initial}
            </Link>
          </div>
        </div>

        {/* ── Row 2: Mode switcher (3 tabs) ────────────────────────────────── */}
        <div className={cn(
          "px-3 pb-2.5 transition-opacity",
          !hydrated && "opacity-0 pointer-events-none"
        )}>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            {(["terrain", "admin", "commercial"] as const).map((m) => {
              const mcfg  = MODE_CONFIG[m];
              const Icon  = mcfg.icon;
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => handleSwitchMode(m)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-[12px] font-bold transition-all duration-150",
                    active
                      ? cn("bg-white shadow-sm", mcfg.color)
                      : "text-slate-400 active:text-slate-600"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{mcfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Main content — SPA tab cache ────────────────────────────────────── */}
      <main className={cn(
        "flex-1 relative overflow-hidden",
        modeAnim === "right" && "animate-mode-right",
        modeAnim === "left"  && "animate-mode-left",
      )}>
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

      {/* ── FAB backdrop ─────────────────────────────────────────────────────── */}
      {fabOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setFabOpen(false)} />
      )}

      {/* ── FAB actions ──────────────────────────────────────────────────────── */}
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

      {/* ── Photo capture bottom sheet ───────────────────────────────────────── */}
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
                <button onClick={() => handlePhotoAction("intervention")}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-violet-50 active:bg-violet-100">
                  <div className="w-9 h-9 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0">
                    <Paperclip className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Attacher à une intervention</p>
                    <p className="text-xs text-slate-500">Choisir une intervention existante</p>
                  </div>
                </button>
                <button onClick={() => handlePhotoAction("new-intervention")}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 active:bg-amber-100">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Créer une intervention</p>
                    <p className="text-xs text-slate-500">Nouvelle intervention avec cette photo</p>
                  </div>
                </button>
                <button onClick={() => handlePhotoAction("new-devis")}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-blue-50 active:bg-blue-100">
                  <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Créer un devis</p>
                    <p className="text-xs text-slate-500">Nouveau devis avec cette photo</p>
                  </div>
                </button>
                <button onClick={() => { setCapturedPhoto(null); router.push("/documents"); }}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 active:bg-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <ScanLine className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Enregistrer dans Mes documents</p>
                    <p className="text-xs text-slate-500">Ticket, facture, scan de document</p>
                  </div>
                </button>
                <button onClick={() => setCapturedPhoto(null)}
                  className="flex items-center justify-center px-4 py-3.5 rounded-2xl bg-slate-100 active:bg-slate-200 mt-1">
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
              <button onClick={() => setNotifOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
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
                <>
                  <NotifSection
                    icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    label="Urgent" color="text-red-600"
                    items={(notifications || []).filter((n) => n.category === "urgent")}
                    onClose={() => setNotifOpen(false)}
                  />
                  <NotifSection
                    icon={<Clock className="w-3.5 h-3.5 text-blue-500" />}
                    label="Aujourd'hui" color="text-blue-600"
                    items={(notifications || []).filter((n) => n.category === "today")}
                    onClose={() => setNotifOpen(false)}
                  />
                  <NotifSection
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    label="À traiter" color="text-emerald-600"
                    items={(notifications || []).filter((n) => n.category === "admin")}
                    onClose={() => setNotifOpen(false)}
                  />
                </>
              )}
              <div className="h-4" />
            </div>
          </div>
        </>
      )}

      {/* ── Bottom nav: 2 tabs | FAB | 2 tabs ───────────────────────────────── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 bg-white border-t border-slate-100 pb-safe shadow-lg shadow-black/5">
        <div className="flex items-center px-1 py-1.5">
          {navLeft.map((item) => (
            <NavTab key={item.href} item={item} pathname={pathname} relancesCount={relancesCount} mode={mode} />
          ))}

          {/* FAB — color follows mode */}
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className={cn(
              "w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-200 flex-shrink-0 mx-1",
              fabOpen ? "bg-slate-800" : cn(cfg.bg, "shadow-lg")
            )}
            aria-label="Actions rapides"
          >
            <Plus className={cn("w-6 h-6 text-white transition-transform duration-200", fabOpen && "rotate-45")} />
          </button>

          {navRight.map((item) => (
            <NavTab key={item.href} item={item} pathname={pathname} relancesCount={relancesCount} mode={mode} />
          ))}
        </div>
      </nav>
    </div>
  );
}

// ─── NavTab ───────────────────────────────────────────────────────────────────

function NavTab({
  item, pathname, relancesCount, mode,
}: {
  item: NavItem;
  pathname: string;
  relancesCount: number;
  mode: AppMode;
}) {
  const isActive = (() => {
    // Hub pages: exact match only (prevent /commercial/* from all lighting up hub)
    if (item.href === "/terrain" || item.href === "/commercial") {
      return pathname === item.href;
    }
    if (item.href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  })();

  const badge = item.href === "/relances" && relancesCount > 0 ? relancesCount : 0;

  const activeColor = mode === "terrain" ? "text-amber-600"
    : mode === "commercial" ? "text-violet-600"
    : "text-blue-600";

  return (
    <Link
      href={item.href}
      prefetch={true}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors",
        isActive ? activeColor : "text-slate-400"
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
              {n.subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{n.subtitle}</p>}
              {n.timestamp && <p className="text-[10px] text-slate-300 mt-0.5">{formatDate(n.timestamp)}</p>}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
