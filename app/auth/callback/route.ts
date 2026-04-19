import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// OAuth callback (Google) + magic links (password reset, email confirm…)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const redirectTo =
      type === "recovery"
        ? `${origin}/auth/update-password`
        : `${origin}${next}`;

    // Build the redirect response FIRST, then set cookies ON it.
    // This guarantees Set-Cookie headers travel with the 302 response
    // and the browser receives the session immediately.
    const response = NextResponse.redirect(redirectTo);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
