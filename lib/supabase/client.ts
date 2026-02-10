import { createBrowserClient } from "@supabase/ssr";

/**
 * Tworzy klienta Supabase do użycia w komponencie po stronie przeglądarki (Client Components).
 * Wykorzystuje @supabase/ssr, który automatycznie zarządza ciasteczkami sesji.
 * @returns Klient Supabase skonfigurowany dla przeglądarki
 * @throws Error gdy brakuje zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY
 * @example
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase/client'
 *
 * export function MyComponent() {
 *   const supabase = createClient()
 *   // ...
 * }
 * ```
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Brakuje zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  // Use local proxy to bypass uMatrix/AdBlockers
  // Valid URL is required by createBrowserClient
  const isBrowser = typeof window !== "undefined";
  const proxyUrl = isBrowser
    ? `${globalThis.location.origin}/api/db`
    : supabaseUrl;

  // Determine the correct cookie name prefix from the REAL Supabase URL
  // This ensures cookies match what createServerClient expects (sb-<project-ref>-auth-token)
  // regardless of whether we are using a proxy URL (localhost) or not.
  const projectReference = (/https?:\/\/([^.]+)\./.exec(supabaseUrl))?.[1];
  const cookieName = projectReference ? `sb-${projectReference}-auth-token` : undefined;

  return createBrowserClient(proxyUrl, supabaseAnonKey, {
    cookieOptions: {
      name: cookieName,
    },
  });
}
