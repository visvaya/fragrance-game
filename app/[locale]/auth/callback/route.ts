import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { redirectPathFrom } from "@/lib/auth/redirect-path";
import { createClient } from "@/lib/supabase/server";

/** Handles the Supabase OAuth callback, exchanges the code for a session, and redirects. */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ locale: string }> },
) {
  const params = await props.params;
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = redirectPathFrom(searchParams);
  // The locale is part of the path, but we might want to redirect to the correct locale
  const locale = params.locale;

  // Validate locale using routing config
  const activeLocale = routing.locales.includes(
    locale as (typeof routing.locales)[number],
  )
    ? locale
    : routing.defaultLocale;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure redirect path has locale if needed, or rely on middleware
      // Simple approach: redirect to /{locale}/{next} ensuring no double slashes
      const target = next.startsWith("/") ? next : `/${next}`;

      // Check if target already includes a supported locale
      const hasLocale = routing.locales.some((loc) =>
        target.startsWith(`/${loc}`),
      );
      const finalUrl = hasLocale
        ? `${origin}${target}`
        : `${origin}/${activeLocale}${target}`;

      return NextResponse.redirect(finalUrl);
    }
  }

  // Return the user to login page with error
  return NextResponse.redirect(
    `${origin}/${activeLocale}/auth/login?error=AuthCodeError`,
  );
}
