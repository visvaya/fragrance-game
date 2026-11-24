import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  // CI logs every test by name and result; the HTML report goes into the run's artifact.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: "http://localhost:3000",
    // A trace records request headers and storage, and CI artifacts are public: no traces in CI
    // unless a run asks for them (PLAYWRIGHT_TRACE=1) while a failure is diagnosed.
    trace:
      process.env.CI && !process.env.PLAYWRIGHT_TRACE
        ? "off"
        : "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    /* Test against mobile viewports. */
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
    /* Specialized Projects */
    {
      name: "smoke",
      testDir: "./e2e/smoke",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "visual",
      testDir: "./e2e/visual",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI ? "pnpm run start" : "pnpm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 90000, // 90s for Next.js cold start (default is 30s)
  },
});
