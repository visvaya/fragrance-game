import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Node 25+ defines its own global localStorage (undefined without --localstorage-file),
    // which shadows jsdom's storage in the test workers.
    execArgv: ["--no-experimental-webstorage"],
    globals: true,
    setupFiles: "./vitest.setup.ts",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    env: {
      CRON_SECRET: "test-cron-secret",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key",
      // Integration tests (VITEST_INTEGRATION=true) use real credentials from CI secrets.
      // Fallback mock values are used for unit tests that mock Supabase entirely.
      // `||` rather than `??`: GitHub Actions passes an unavailable secret (for example
      // in Dependabot runs) as an empty string, which must also fall back.
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key",
      // Upstash is mocked in vitest.setup.ts, but lib/env.ts still validates the shape.
      UPSTASH_REDIS_REST_TOKEN:
        process.env.UPSTASH_REDIS_REST_TOKEN || "test-redis-token",
      UPSTASH_REDIS_REST_URL:
        process.env.UPSTASH_REDIS_REST_URL || "https://test.upstash.io",
    },
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],
      include: [
        "app/actions/**/*.ts",
        "app/api/**/*.ts",
        "lib/**/*.{ts,tsx}",
        "components/game/**/*.tsx",
        "proxy.ts",
      ],
      exclude: [
        "**/__tests__/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.ts",
        "node_modules/**",
        "e2e/**",
        "vitest.setup.ts",
        "components/ui/**", // shadcn/ui components (low priority)
      ],
      thresholds: {
        // Ratchet: raised to the measurement, never lowered. The global numbers include UI
        // (2026-11-18 on CI: 71.24/60.26/62.52/69.41); the logic directories have their own
        // floors (2026-11-19: lib/game 98.14/88.96/100/99.63, app/actions 91.97/83.1/97.36/93.68,
        // game contexts 94.17/83.05/78.72/96.58 as statements/branches/functions/lines).
        lines: 71,
        functions: 60,
        branches: 62,
        statements: 69,
        "lib/game/**": {
          branches: 88,
          functions: 100,
          lines: 99,
          statements: 98,
        },
        "app/actions/**": {
          branches: 83,
          functions: 97,
          lines: 93,
          statements: 91,
        },
        "components/game/contexts/**": {
          branches: 83,
          functions: 78,
          lines: 96,
          statements: 94,
        },
      },
    },
  },
});
