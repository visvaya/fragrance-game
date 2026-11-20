/**
 * Public variables for browser code, inlined by Next at build time.
 *
 * Browser code reads them here instead of `@/lib/env`, whose Zod schemas would otherwise ship
 * in the start-up bundle. `@/lib/env` still validates the same variables on the server, which
 * renders every page first, so a missing or malformed value fails there.
 */
export const publicEnv = {
  NEXT_PUBLIC_GAME_RESET_ENABLED: process.env.NEXT_PUBLIC_GAME_RESET_ENABLED,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
} as const;
