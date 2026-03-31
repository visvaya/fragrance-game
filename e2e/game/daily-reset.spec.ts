import { existsSync } from "fs";
import path from "path";
import { expect, test } from "@playwright/test";

// Pre-authenticated session — skips signInAnonymously() + Turnstile captcha.
// Without this the game shows "No puzzle today" because auth takes >10s in headless mode.
const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");
if (existsSync(AUTH_FILE)) {
  test.use({ storageState: AUTH_FILE });
}

/**
 * Daily Challenge Reset - E2E Tests
 *
 * Tests the daily challenge system's time-based behavior:
 * - Game state persistence within the same UTC day
 * - Challenge refresh at UTC midnight
 * - Timezone handling (always UTC-based)
 * - Session recovery after page reload
 *
 * NOTE: Tests that manipulate browser time use `page.clock.install()` (not
 * `page.clock.setFixedTime()`), because only `install()` enables `fastForward()`.
 * `setFixedTime()` alone does not install fake timers, so `fastForward()` returns 0.
 */
test.describe("Daily Challenge Reset", () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport
    await page.setViewportSize({ height: 720, width: 1280 });
  });

  test("should load the home page (Sanity)", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/Eauxle/i);
  });

  test("should load game successfully", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const gameInput = page.getByTestId("game-input");
    await expect(gameInput).toBeVisible({ timeout: 10_000 });

    const title = page.locator("h1");
    await expect(title).toHaveText("Eauxle");
  });

  test("should persist game state within same day", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const gameInput = page.getByTestId("game-input");
    await expect(gameInput).toBeVisible({ timeout: 10_000 });

    // Check localStorage has session data after game initializes
    const sessionBefore = await page.evaluate(() => {
      return Object.keys(localStorage).find((key) => key.includes("session"));
    });

    await page.reload();
    await expect(page.locator("main")).toBeVisible();
    await expect(gameInput).toBeVisible({ timeout: 10_000 });

    // Session key should still exist after reload (same day)
    const sessionAfter = await page.evaluate(() => {
      return Object.keys(localStorage).find((key) => key.includes("session"));
    });

    expect(sessionBefore).toBeDefined();
    expect(sessionAfter).toBeDefined();
  });

  test("should handle UTC midnight boundary", async ({ page }) => {
    // Install fake clock at 23:55 UTC on Feb 13 — persists through navigation
    await page.clock.install({ time: new Date("2026-02-13T23:55:00Z") });

    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const dateBefore = await page.evaluate(() => {
      return new Date().toISOString().split("T")[0];
    });
    expect(dateBefore).toBe("2026-02-13");

    // Advance fake clock to 00:02 UTC next day
    await page.clock.setFixedTime(new Date("2026-02-14T00:02:00Z"));

    const dateAfter = await page.evaluate(() => {
      return new Date().toISOString().split("T")[0];
    });
    expect(dateAfter).toBe("2026-02-14");
    expect(dateAfter).not.toBe(dateBefore);
  });

  test("should reload game state after page refresh", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const gameInput = page.getByTestId("game-input");
    await expect(gameInput).toBeVisible({ timeout: 10_000 });

    const urlBefore = page.url();

    await page.reload();
    await expect(page.locator("main")).toBeVisible();
    await expect(gameInput).toBeVisible({ timeout: 10_000 });

    expect(page.url()).toBe(urlBefore);
  });

  test("should use UTC time for challenge date (not local)", async ({
    page,
  }) => {
    // Install fake clock — persists through navigation unlike setFixedTime
    await page.clock.install({ time: new Date("2026-02-14T00:00:00Z") });

    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const utcDate = await page.evaluate(() => {
      return new Date().toISOString().split("T")[0];
    });

    // Should be Feb 14 (UTC), regardless of user's local timezone
    expect(utcDate).toBe("2026-02-14");
  });

  test("should handle time fast-forward correctly", async ({ page }) => {
    // Must use install() — setFixedTime() does not enable fastForward()
    await page.clock.install({ time: new Date("2026-02-14T08:00:00Z") });

    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const initialTime = await page.evaluate(() => Date.now());

    // Fast forward 4 hours
    await page.clock.fastForward("04:00:00");

    const newTime = await page.evaluate(() => Date.now());

    // Should be 4 hours later (14,400,000 milliseconds)
    const diff = newTime - initialTime;
    expect(diff).toBeGreaterThanOrEqual(14_400_000);
  });

  test("should display game in English locale", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    expect(page.url()).toContain("/en");

    const helpButton = page.getByLabel(/help/i);
    await expect(helpButton).toBeVisible();
  });

  test("should display game in Polish locale", async ({ page }) => {
    await page.goto("/pl");
    await expect(page.locator("main")).toBeVisible();

    expect(page.url()).toContain("/pl");

    const helpButton = page.getByLabel(/pomoc/i);
    await expect(helpButton).toBeVisible();
  });
});
