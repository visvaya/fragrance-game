import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated environment variables for the Eauxle application.
 * Fails fast at startup if required variables are missing or malformed.
 *
 * Usage: import { env } from "@/lib/env"
 */
export const env = createEnv({
  /**
   * Client-side variables — must be prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_ASSETS_HOST: z.string().optional(),
    NEXT_PUBLIC_GAME_RESET_ENABLED: z.enum(["true", "false"]).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
    NEXT_PUBLIC_POSTHOG_UI_HOST: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  },

  /**
   * Runtime environment — maps process.env to the validated schema.
   * Required by {@link https://github.com/t3-oss/env-nextjs | t3-oss/env-nextjs} for edge/server split validation.
   */
  runtimeEnv: {
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_ASSETS_HOST: process.env.NEXT_PUBLIC_ASSETS_HOST,
    NEXT_PUBLIC_GAME_RESET_ENABLED: process.env.NEXT_PUBLIC_GAME_RESET_ENABLED,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  /**
   * Server-side variables — never exposed to the browser.
   */
  server: {
    ALLOWED_ORIGINS: z.string().optional(),
    CRON_SECRET: z.string().min(1),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  },

  /**
   * Skip validation during build (e.g. CI without full env set).
   * Set SKIP_ENV_VALIDATION=1 in CI to allow building without all vars.
   */
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
