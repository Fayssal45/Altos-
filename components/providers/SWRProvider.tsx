"use client";
import { SWRConfig } from "swr";

/**
 * Wraps the app in SWRConfig with server-prefetched fallback data.
 * This lets client components (EstimateList, ClientList, etc.) render
 * instantly on first visit — the data is already in the SWR cache.
 */
export default function SWRProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: Record<string, unknown>;
}) {
  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
}
