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
