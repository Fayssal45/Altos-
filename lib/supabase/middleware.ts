import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  // Routes publiques — /auth/ MUST be public so OAuth callback can exchange code
  const publicPrefixes = ["/login", "/signup", "/p/", "/api/", "/auth/"];
  const isPublic = publicPrefixes.some((r) => pathname.startsWith(r));

  if (!isPublic) {
    // getUser() contacts Supabase to validate the access token and refreshes it
    // if expired (using the refresh token). The setAll handler above writes the
    // new cookies onto both request and supabaseResponse, so the browser receives
    // a fresh token and the session stays alive across the 1-hour access token TTL.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
