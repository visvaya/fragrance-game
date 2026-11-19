import { existsSync } from "node:fs";
import path from "node:path";

import { test, expect } from "@playwright/test";

// Pre-authenticated session – skips signInAnonymously() + Turnstile captcha.
// Without this the game shows "No puzzle today" because auth takes >10s in headless mode.
// Playwright runs from the project root and loads specs as CommonJS; import.meta
// would make Node parse the file as an ES module ("exports is not defined").
const DIR = path.join(process.cwd(), "e2e", "i18n");
const AUTH_FILE = path.join(DIR, "..", ".auth", "user.json");
if (existsSync(AUTH_FILE)) {
  test.use({ storageState: AUTH_FILE });
}

test.describe("Locale Switching", () => {
  test("should default to English locale", async ({ page }) => {
    await page.goto("/");

    // Should redirect to /en/
    await expect(page).toHaveURL(/\/en\/?/);

    // Check HTML lang attribute
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Check page title contains Eauxle
    const title = await page.title();
    expect(title).toContain("Eauxle");
  });

  test("should switch to Polish when /pl/ accessed", async ({ page }) => {
    await page.goto("/pl");

    await expect(page).toHaveURL(/\/pl\/?/);

    // Check Polish content (looking for Polish-specific UI elements)
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();

    // Verify Polish is loaded by checking language attribute
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });

  test("should have correct lang attribute for English", async ({ page }) => {
    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("should persist locale across page load", async ({ page }) => {
    // Increase test timeout for Firefox stability
    test.setTimeout(60_000);

    // Start with Polish
    await page.goto("/pl");
    await expect(page).toHaveURL(/\/pl\/?/);

    // Reload page (increased timeout for Firefox stability)
    await page.reload({ timeout: 60_000 });

    // Should still be on Polish
    await expect(page).toHaveURL(/\/pl\/?/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });

  test("should handle invalid locale gracefully", async ({ page }) => {
    // An unsupported locale is a path under the default locale, which does not exist.
    const response = await page.goto("/de");

    await expect(page).toHaveURL(/\/en\/de$/);
    expect(response?.status()).toBe(404);
  });

  test("should display localized metadata", async ({ page }) => {
    // Check English metadata
    await page.goto("/en");
    const enTitle = await page.title();
    expect(enTitle).toBeTruthy();
    expect(enTitle).toContain("Eauxle");

    // Check Polish metadata (should have different title or description)
    await page.goto("/pl");
    const plTitle = await page.title();
    expect(plTitle).toBeTruthy();
    expect(plTitle).toContain("Eauxle");
  });

  test("should localize placeholder text", async ({ page }) => {
    const enInput = page.getByPlaceholder(/Guess the fragrance/i);
    const closedMessage = page.getByText(/Come back tomorrow/i);

    await page.goto("/en");
    // Wait until the game has loaded one of its two states before deciding to skip.
    await expect(enInput.or(closedMessage)).toBeVisible({ timeout: 15_000 });
    test.skip(
      await closedMessage.isVisible(),
      "Game is closed for this player today.",
    );

    await page.goto("/pl");
    await expect(
      page.getByPlaceholder(/Napisz jakie to perfumy/i),
    ).toBeVisible();
  });

  test("should localize button and UI text", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("body")).toContainText(/guess|attempt|score/i);

    await page.goto("/pl");
    await expect(page.locator("body")).toContainText(/Napisz|próba|wynik/);
  });
});

test.describe("Locale URL Structure", () => {
  test("should maintain locale in URL for all pages", async ({ page }) => {
    // Start with Polish
    await page.goto("/pl");

    // Every internal page link keeps the /pl prefix.
    const hrefs = await page
      .locator("a[href^='/']")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));

    for (const href of hrefs) {
      expect(href).toMatch(/^\/pl(\/|$)/);
    }
  });

  test("should accept both /locale and /locale/ formats", async ({ page }) => {
    // Without trailing slash
    await page.goto("/en");
    expect(page.url()).toMatch(/\/en\/?/);

    // With trailing slash
    await page.goto("/en/");
    expect(page.url()).toMatch(/\/en\/?/);

    // Both should work
  });
});

test.describe("Locale Content Validation", () => {
  test("should not show untranslated keys (en)", async ({ page }) => {
    await page.goto("/en");

    // Check that we don't see raw translation keys like "Game.start" or "Header.menu"
    const content = await page.locator("body").textContent();

    expect(content).not.toContain("Game.start");
    expect(content).not.toContain("Header.menu");
    expect(content).not.toContain("Footer.copyright");
    expect(content).not.toContain("Common.");
  });

  test("should not show untranslated keys (pl)", async ({ page }) => {
    await page.goto("/pl");

    // Check that we don't see raw translation keys
    const content = await page.locator("body").textContent();

    expect(content).not.toContain("Game.start");
    expect(content).not.toContain("Header.menu");
    expect(content).not.toContain("Footer.copyright");
    expect(content).not.toContain("Common.");
  });
});
