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
