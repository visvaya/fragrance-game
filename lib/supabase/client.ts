import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tworzy klienta Supabase do użycia w komponencie po stronie przeglądarki (Client Components).
 * Wykorzystuje \`@supabase/ssr\`, który automatycznie zarządza ciasteczkami sesji.
 * @returns Klient Supabase skonfigurowany dla przeglądarki
 * @throws {Error} gdy brakuje zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY
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
export function createClient(): SupabaseClient<Database> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Use local proxy to bypass uMatrix/AdBlockers
  // Valid URL is required by createBrowserClient
  // eslint-disable-next-line unicorn/prefer-global-this -- typeof window required for SSR safety (ReferenceError-safe)
  const isBrowser = typeof window !== "undefined";
  const proxyUrl = isBrowser
    ? // eslint-disable-next-line unicorn/prefer-global-this -- window.location.origin used after isBrowser guard; globalThis.window lacks type narrowing in this conditional
      `${window.location.origin}/api/db`
    : supabaseUrl;

  // Determine the correct cookie name prefix from the REAL Supabase URL
  // This ensures cookies match what createServerClient expects (sb-<project-ref>-auth-token)
  // regardless of whether we are using a proxy URL (localhost) or not.
  const projectReference = /https?:\/\/([^.]+)\./.exec(supabaseUrl)?.[1];
  const cookieName = projectReference
    ? `sb-${projectReference}-auth-token`
    : undefined;

  return createBrowserClient(proxyUrl, supabaseAnonKey, {
    cookieOptions: {
      name: cookieName,
    },
  });
}
