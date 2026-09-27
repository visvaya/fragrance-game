import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for use in browser-side components (Client Components).
 * Utilizes `@supabase/ssr`, which automatically manages session cookies.
 * @returns Supabase client configured for the browser
 * @throws {Error} when NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are missing
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
  // eslint-disable-next-line unicorn/prefer-global-this -- safer for SSR pre-render
  const isBrowser = typeof window !== "undefined";
  const proxyUrl = isBrowser
    ? `${globalThis.location.origin}/api/db`
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
