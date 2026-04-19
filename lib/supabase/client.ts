import { createBrowserClient } from "@supabase/ssr";

// Singleton — one client instance for the entire browser session.
// createBrowserClient already handles this internally, but we memoize here
// to avoid any overhead from repeated calls across components.
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
