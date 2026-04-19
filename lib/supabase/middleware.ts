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
    // getSession() reads the JWT from cookie — no Supabase network call.
    // JWT is cryptographically signed so it cannot be forged.
    // Individual server components call getUser() when they need verified identity.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
