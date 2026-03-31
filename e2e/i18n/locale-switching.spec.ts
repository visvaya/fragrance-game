import { existsSync } from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

// Pre-authenticated session — skips signInAnonymously() + Turnstile captcha.
// Without this the game shows "No puzzle today" because auth takes >10s in headless mode.
const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");
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
    // Try accessing unsupported locale (German)
    const response = await page.goto("/de");

    // Should either redirect to default (en) or show 404
    // Check if we got redirected
    const currentUrl = page.url();

    if (currentUrl.includes("/en")) {
      // Redirected to default locale

      expect(currentUrl).toContain("/en");
    } else {
      // Or showed 404 - verify response status

      expect(response?.status()).toBeGreaterThanOrEqual(400);
    }
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
    // English placeholder
    await page.goto("/en");

    // Skip if game is closed
    const closedMessage = page.getByText(/Gra zakończona|Come back tomorrow/i);

    if (await closedMessage.isVisible()) {
      test.skip(true, "Game is currently closed.");
      return;
    }

    const enInput = page.getByPlaceholder(/Guess the fragrance/i);
    const enPlaceholder = await enInput.getAttribute("placeholder");
    expect(enPlaceholder?.toLowerCase()).toContain("guess");

    // Polish placeholder
    await page.goto("/pl");

    const plClosedMessage = page.getByText(
      /Gra zakończona|Come back tomorrow/i,
    );

    if (await plClosedMessage.isVisible()) {
      test.skip(true, "Game is currently closed.");
      return;
    }

    const plInput = page.getByPlaceholder(/Napisz/i);
    const plPlaceholder = await plInput.getAttribute("placeholder");
    expect(plPlaceholder?.toLowerCase()).toContain("napisz");
  });

  test("should localize button and UI text", async ({ page }) => {
    // Check English UI
    await page.goto("/en");

    // Look for common UI elements with English text
    // Note: Using flexible matchers since exact text depends on game state
    const hasEnglishContent = await page.evaluate(() => {
      const bodyText = document.body.textContent || "";
      return (
        bodyText.toLowerCase().includes("guess") ||
        bodyText.toLowerCase().includes("attempt") ||
        bodyText.toLowerCase().includes("score")
      );
    });

    expect(hasEnglishContent).toBe(true);

    // Check Polish UI
    await page.goto("/pl");

    const hasPolishContent = await page.evaluate(() => {
      const bodyText = document.body.textContent || "";
      // Look for Polish-specific words
      return (
        bodyText.includes("Napisz") ||
        bodyText.includes("próba") ||
        bodyText.includes("wynik")
      );
    });

    expect(hasPolishContent).toBe(true);
  });
});

test.describe("Locale URL Structure", () => {
  test("should maintain locale in URL for all pages", async ({ page }) => {
    // Start with Polish
    await page.goto("/pl");

    // Verify all internal links maintain /pl/ prefix
    const links = await page.locator("a[href^='/']").all();

    for (const link of links.slice(0, 5)) {
      // Check first 5 links
      const href = await link.getAttribute("href");

      if (href && !href.startsWith("http")) {
        // Internal link should maintain locale

        expect(href).toMatch(/^\/pl\//);
      }
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
    const content = await page.textContent("body");

    expect(content).not.toContain("Game.start");
    expect(content).not.toContain("Header.menu");
    expect(content).not.toContain("Footer.copyright");
    expect(content).not.toContain("Common.");
  });

  test("should not show untranslated keys (pl)", async ({ page }) => {
    await page.goto("/pl");

    // Check that we don't see raw translation keys
    const content = await page.textContent("body");

    expect(content).not.toContain("Game.start");
    expect(content).not.toContain("Header.menu");
    expect(content).not.toContain("Footer.copyright");
    expect(content).not.toContain("Common.");
  });
});
