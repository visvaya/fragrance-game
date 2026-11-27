// Environment variables the code reads by name. Declaring them keeps `process.env.NAME` valid
// under noPropertyAccessFromIndexSignature; Next.js inlines NEXT_PUBLIC_* only in that dot form.
// Values are validated in lib/env.ts; add a new variable there, in .env.example and here.
declare namespace NodeJS {
  // eslint-disable-next-line typescript/consistent-type-definitions -- only an interface merges with the ProcessEnv declaration of @types/node
  interface ProcessEnv {
    // jscpd:ignore-start -- one declaration per variable; the lines repeat by design
    ALLOWED_ORIGINS?: string;
    ANALYZE?: string;
    CI?: string;
    CRON_SECRET?: string;
    E2E_TEST_PASSWORD?: string;
    GUEST_TICKET_SECRET?: string;
    NEXT_PUBLIC_ASSETS_HOST?: string;
    NEXT_PUBLIC_GAME_RESET_ENABLED?: string;
    NEXT_PUBLIC_POSTHOG_HOST?: string;
    NEXT_PUBLIC_POSTHOG_KEY?: string;
    NEXT_PUBLIC_POSTHOG_UI_HOST?: string;
    NEXT_PUBLIC_SENTRY_DSN?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
    NEXT_PUBLIC_VERCEL_ENV?: string;
    NEXT_RUNTIME?: string;
    PLAYWRIGHT_TRACE?: string;
    SENTRY_ORG?: string;
    SENTRY_PROJECT?: string;
    SITE_URL?: string;
    SKIP_ENV_VALIDATION?: string;
    SUPABASE_ACCESS_TOKEN?: string;
    SUPABASE_PROJECT_ID?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    TEST_SUPABASE_SERVICE_ROLE_KEY?: string;
    TEST_SUPABASE_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;
    UPSTASH_REDIS_REST_URL?: string;
    VERCEL_PROJECT_PRODUCTION_URL?: string;
    VITEST_INTEGRATION?: string;
    // jscpd:ignore-end
  }
}
