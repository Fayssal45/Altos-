import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Altos – Gestion Artisan",
  description: "Devis, factures et interventions pour artisans du bâtiment",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Altos",
  },
  openGraph: {
    title: "Altos – Gestion Artisan",
    description: "Devis, factures et interventions pour artisans du bâtiment",
    images: [{ url: "/logo-full.svg", width: 200, height: 150, alt: "Altos" }],
  },
  twitter: {
    card: "summary",
    title: "Altos – Gestion Artisan",
    images: ["/logo-full.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${geist.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/logo-icon.svg" />
        {/* Pre-connect to Supabase so DB queries start immediately */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
      </head>
      <body className="h-full bg-slate-50 font-[var(--font-geist)] antialiased touch-manipulation">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "12px",
              fontFamily: "var(--font-geist)",
              fontSize: "15px",
              fontWeight: "500",
            },
          }}
        />
      </body>
    </html>
  );
}
