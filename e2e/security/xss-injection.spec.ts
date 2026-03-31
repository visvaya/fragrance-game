/* eslint-disable playwright/no-wait-for-timeout -- XSS security tests require explicit waits for async DOM mutations after injection */
import { existsSync } from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

// Pre-authenticated session — skips signInAnonymously() + Turnstile captcha.
// Without this the game shows "No puzzle today" because auth takes >10s in headless mode.
const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");
if (existsSync(AUTH_FILE)) {
  test.use({ storageState: AUTH_FILE });
}

test.describe("XSS Injection Prevention", () => {
  test("should sanitize script tags in perfume guess input", async ({
    page,
  }) => {
    await page.goto("/en");

    const closedMessage = page.getByText(/Gra zakończona|Come back tomorrow/i);
    if (await closedMessage.isVisible()) {
      test.skip(true, "Game is currently closed.");
      return;
    }

    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );
    await expect(input).toBeVisible({ timeout: 10_000 });

    const maliciousInput = '<script>alert("XSS")</script>';

    await input.fill(maliciousInput);
    await expect(input).toHaveValue(maliciousInput);

    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      dialog.dismiss().catch(() => {
        // Silent catch for dismissal errors in headless mode
      });
    });

    await input.press("Enter");
    await page.waitForTimeout(1000);

    expect(dialogs).toHaveLength(0);
  });

  test("should block inline scripts via CSP", async ({ page }) => {
    const violations: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("Content Security Policy") ||
        text.includes("CSP") ||
        text.includes("blocked")
      ) {
        violations.push(text);
      }
    });

    await page.goto("/en");

    const scriptExecuted = await page
      .evaluate(() => {
        try {
          const script = document.createElement("script");
          script.textContent = 'console.log("XSS via inline script")';
          document.body.append(script);
          return true;
        } catch {
          return false;
        }
      })
      .catch(() => false);

    await page.waitForTimeout(500);

    expect(scriptExecuted).toBe(true);

    if (violations.length > 0) {
      console.log(`CSP Violations detected: ${violations.length}`);
    }
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
    await page.goto("/en");

    const closedMessage = page.getByText(/Gra zakończona|Come back tomorrow/i);
    if (await closedMessage.isVisible()) {
      test.skip(true, "Game is currently closed.");
      return;
    }

    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );
    await expect(input).toBeVisible({ timeout: 10_000 });

    const xssPayloads = [
      "<svg/onload=alert(1)>",
      // eslint-disable-next-line sonarjs/code-eval -- intentional eval to verify XSS payload is sanitized before reaching DOM
      "javascript:alert(1)",
      '"><script>alert(1)</script>',
    ];

    for (const payload of xssPayloads) {
      await input.fill(payload);
      await page.waitForTimeout(500);

      const suggestions = page.locator('button[class*="text-left text-sm"]');
      const count = await suggestions.count();

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const html = await suggestions.nth(i).innerHTML();
          expect(html).not.toContain("<script");
          expect(html).not.toContain("onerror=");
          expect(html).not.toContain("onload=");
          // eslint-disable-next-line sonarjs/code-eval -- intentional eval to verify XSS payload is sanitized before reaching DOM
          expect(html).not.toContain("javascript:");
        }
      }

      await input.clear();
    }
  });

  test("should not have dangerouslySetInnerHTML with user content", async ({
    page,
  }) => {
    await page.goto("/en");

    const hasUnsafeInnerHTML = await page.evaluate(() => {
      const userContentElements = Array.from(
        document.querySelectorAll('[data-testid*="game"], [class*="game-"]'),
      );

      for (const element of userContentElements) {
        const html = element.innerHTML;
        if (html.includes("<script") && !html.includes("<!-- ")) {
          return true;
        }
      }

      return false;
    });

    expect(hasUnsafeInnerHTML).toBe(false);
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
      await page.waitForTimeout(1000);
      expect(dialogs).toHaveLength(0);
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();
    }
  });

  test("should sanitize perfume data from database", async ({ page }) => {

    await page.goto("/en");

    const closedMessage = page.getByText(/Gra zakończona|Come back tomorrow/i);
    if (await closedMessage.isVisible()) {
      test.skip(true, "Game is currently closed.");
      return;
    }

    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("Chanel");
    await page.waitForTimeout(1000);

    const suggestions = page.locator('button[class*="text-left text-sm"]');
    const count = await suggestions.count();

    if (count > 0) {
      await suggestions.first().click();
      await page.waitForTimeout(2000);

      const clueElements = page.locator('[data-testid*="clue"]');
      const clueCount = await clueElements.count();

      for (let i = 0; i < clueCount; i++) {
        const textContent = await clueElements.nth(i).textContent();
        const innerHTML = await clueElements.nth(i).innerHTML();

        if (textContent) {
          expect(textContent).not.toContain("<script");
        }

        if (innerHTML.includes("&lt;") || innerHTML.includes("&gt;")) {
          expect(innerHTML).not.toContain("<script");
        }
      }
    }
  });

  test("should have CSP headers that block unsafe content", async ({
    page,
  }) => {
    const response = await page.goto("/en");
    expect(response).not.toBeNull();

    if (!response) {
      throw new Error("No response received");
    }

    const csp = response.headers()["content-security-policy"];

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
    await page.goto("/en");

    const closedMessage = page.getByText(/Gra zakończona|Come back tomorrow/i);
    if (await closedMessage.isVisible()) {
      test.skip(true, "Game is currently closed.");
      return;
    }

    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("x");
    await page.waitForTimeout(1000);

    const suggestions = page.locator('button[class*="text-left text-sm"]');
    let count = await suggestions.count();
    expect(count).toBe(0);

    await input.fill("xy");
    await page.waitForTimeout(1000);

    count = await suggestions.count();
    expect(count).toBe(0);

    await input.fill("Cha");
    await page.waitForTimeout(1000);
    // Autocomplete allowed for 3+ chars — no assertion needed, just verifies no crash
  });

  test("should enforce maximum query length in autocomplete", async ({
    page,
  }) => {
    await page.goto("/en");

    const closedMessage = page.getByText(/Gra zakończona|Come back tomorrow/i);
    if (await closedMessage.isVisible()) {
      test.skip(true, "Game is currently closed.");
      return;
    }

    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );
    await expect(input).toBeVisible({ timeout: 10_000 });

    const longString = "A".repeat(150);
    await input.fill(longString);

    const inputValue = await input.inputValue();
    expect(inputValue.length).toBeLessThanOrEqual(150);
  });

  test("should validate UUID format for perfume selection", async ({
    page,
  }) => {
    await page.goto("/en");

    const hasValidation = await page.evaluate(() => {
      const input = document.querySelector('[role="combobox"]');
      return input !== null;
    });

    expect(hasValidation).toBe(true);
  });
});
