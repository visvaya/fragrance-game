import { existsSync } from "node:fs";
import path from "node:path";

import { test, expect, type Locator, type Page } from "@playwright/test";

import { fillAndSearch } from "../support/autocomplete";
import { expectHydrated } from "../support/hydration";

// Pre-authenticated session – skips signInAnonymously() + Turnstile captcha.
// Without this the game shows "No puzzle today" because auth takes >10s in headless mode.
// Playwright runs from the project root and loads specs as CommonJS; import.meta
// would make Node parse the file as an ES module ("exports is not defined").
const DIR = path.join(process.cwd(), "e2e", "security");
const AUTH_FILE = path.join(DIR, "..", ".auth", "user.json");
if (existsSync(AUTH_FILE)) {
  test.use({ storageState: AUTH_FILE });
}

/**
 * Opens the English game page and returns the guess input, skipping the test when today's game is
 * closed for the stored player.
 */
async function openGameInput(page: Page): Promise<Locator> {
  await page.goto("/en");
  const input = page.getByPlaceholder(
    /Guess the fragrance|Napisz jakie to perfumy/i,
  );
  const closedMessage = page.getByText(/Come back tomorrow|Wróć jutro/i);
  // Wait until the game has loaded one of its two states before deciding to skip.
  await expect(input.or(closedMessage)).toBeVisible({ timeout: 15_000 });
  test.skip(
    await closedMessage.isVisible(),
    "Game is closed for this player today.",
  );
  await expectHydrated(input);
  return input;
}

test.describe("XSS Injection Prevention", () => {
  test("should sanitize script tags in perfume guess input", async ({
    page,
  }) => {
    const input = await openGameInput(page);

    const maliciousInput = '<script>alert("XSS")</script>';

    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      dialog.dismiss().catch(() => {
        // Silent catch for dismissal errors in headless mode
      });
    });

    await fillAndSearch(page, input, maliciousInput);
    await expect(input).toHaveValue(maliciousInput);

    await input.press("Enter");
    await expect(input).toHaveValue(maliciousInput);

    expect(dialogs).toHaveLength(0);
  });

  test("should escape HTML entities in displayed content", async ({ page }) => {
    await page.goto("/en");

    const pageContent = await page.content();

    const scriptMatches = pageContent.match(/<script[^>]*>[^<]*alert\(/g);
    expect(scriptMatches).toBeNull();

    const eventHandlerXSS = /on\w+\s*=\s*["'].*alert\(/i.exec(pageContent);
    expect(eventHandlerXSS).toBeNull();
  });

  test("should reject malicious input in autocomplete", async ({ page }) => {
    const input = await openGameInput(page);

    const xssPayloads = [
      "<svg/onload=alert(1)>",

      "javascript:alert(1)",
      '"><script>alert(1)</script>',
    ];

    for (const payload of xssPayloads) {
      await fillAndSearch(page, input, payload);

      const suggestions = page.locator('button[class*="text-left text-sm"]');
      for (const suggestion of await suggestions.all()) {
        const html = await suggestion.innerHTML();
        expect(html).not.toContain("<script");
        expect(html).not.toContain("onerror=");
        expect(html).not.toContain("onload=");
        expect(html).not.toContain("javascript:");
      }

      await input.clear();
    }
  });

  test("should not render script elements inside game content", async ({
    page,
  }) => {
    await page.goto("/en");

    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main script")).toHaveCount(0);
  });

  test("should prevent XSS in URL parameters", async ({ page }) => {
    const dialogs: string[] = [];

    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      dialog.dismiss().catch(() => {
        // Silent catch
      });
    });

    const maliciousUrls = [
      "/en?query=<script>alert('XSS')</script>",
      "/en?name=<img src=x onerror=alert(1)>",
      "/en#<script>alert(1)</script>",
    ];

    for (const url of maliciousUrls) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      expect(dialogs).toHaveLength(0);
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();
    }
  });

  test("should sanitize perfume data from database", async ({ page }) => {
    const input = await openGameInput(page);

    await fillAndSearch(page, input, "Chanel");

    const suggestions = page.locator('button[class*="text-left text-sm"]');
    await expect(suggestions.first()).toBeVisible();
    await suggestions.first().click();
    // The guess is done once the input is cleared after the server action.
    await expect(input).toHaveValue("");

    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("<script");
    await expect(page.locator("main script")).toHaveCount(0);
  });

  test("should have CSP headers that block unsafe content", async ({
    page,
  }) => {
    const response = await page.goto("/en");
    expect(response).not.toBeNull();

    const csp = response?.headers()["content-security-policy"];

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

test.describe("Input Validation Security", () => {
  test("should enforce minimum query length in autocomplete", async ({
    page,
  }) => {
    const input = await openGameInput(page);

    await fillAndSearch(page, input, "x");

    const suggestions = page.locator('button[class*="text-left text-sm"]');
    await expect(suggestions).toHaveCount(0);

    await fillAndSearch(page, input, "xy");

    await expect(suggestions).toHaveCount(0);
  });
});
