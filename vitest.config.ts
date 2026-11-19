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
        // Ratchet: raised to the CI measurement on main (2026-11-18: 71.24/60.26/62.52/69.41),
        // never lowered. Target: lines 80, functions 75, branches 70.
        lines: 71,
        functions: 60,
        branches: 62,
        statements: 69,
      },
    },
  },
});
