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
    },
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],
      include: [
        "app/actions/**/*.ts",
        "lib/**/*.{ts,tsx}",
        "components/game/**/*.tsx",
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
        lines: 35,
        functions: 27,
        branches: 29,
        statements: 36,
      },
    },
  },
});
