import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    env: {
      CRON_SECRET: "test-cron-secret",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key",
      // Integration tests (VITEST_INTEGRATION=true) use real credentials from CI secrets.
      // Fallback mock values are used for unit tests that mock Supabase entirely.
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
      // Upstash is mocked in vitest.setup.ts, but lib/env.ts still validates the shape.
      UPSTASH_REDIS_REST_TOKEN:
        process.env.UPSTASH_REDIS_REST_TOKEN ?? "test-redis-token",
      UPSTASH_REDIS_REST_URL:
        process.env.UPSTASH_REDIS_REST_URL ?? "https://test.upstash.io",
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
        // Etap 1 (2026-04-01): podniesione z 35/27/29/36
        // Etap 2 (2026-04-01 po Sesji 3): podniesione z 40/32/30/38 — aktuale: 47/36/36/46
        // Etap 3 (2026-04-02 po Sesji 5): podniesione z 45/34/35/44 — aktuale: 52.71/40.6/40.53/54.33
        // Etap 4 (2026-04-02 po Sesji 6): podniesione z 52/40/40/52 — aktuale: 62.5/49.8/51.24/60.67
        // Etap 5 (po Sesji 7, game-provider + game-actions-context): cel 65/55/52/62
        // Cel końcowy (Q3 2026): linie 80, funkcje 75, branches 70
        lines: 61,
        functions: 48,
        branches: 50,
        statements: 59,
      },
    },
  },
});
