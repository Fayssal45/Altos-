import type { NextConfig } from "next";

// next-pwa uses webpack; disable in dev to avoid Turbopack conflicts
const withPWA =
  process.env.NODE_ENV === "production"
    ? require("next-pwa")({
        dest: "public",
        register: true,
        skipWaiting: true,
        buildExcludes: [/middleware-manifest\.json$/],
      })
    : (config: NextConfig) => config;

const nextConfig: NextConfig = {
  // Use webpack in production (for next-pwa), Turbopack in dev
  turbopack: {},
  experimental: {
    // Cache dynamic route payloads client-side for 60s.
    // Combined with router.prefetch() in AppShell, tab navigation is instant.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = withPWA(nextConfig);
