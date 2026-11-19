import { test, expect } from "@playwright/test";

type ViolationWindow = Window & { cspViolations?: string[] };

test.describe("Content Security Policy @smoke", () => {
  // The root layout's theme script adds the dark class only when it runs, so this color scheme
  // proves that the per-request nonce reached the layout.
  test.use({ colorScheme: "dark" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const target = globalThis as unknown as ViolationWindow;
      target.cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        target.cspViolations?.push(
          `${event.violatedDirective} ${event.blockedURI}`,
        );
      });
    });
  });

  for (const path of ["/en", "/en/auth/login", "/en/no-such-page"]) {
    test(`runs the page's own scripts on ${path} without violations`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      const violations = await page.evaluate(
        () => (globalThis as unknown as ViolationWindow).cspViolations,
      );
      expect(violations).toEqual([]);
    });
  }

  test("blocks an inline script injected into the page", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const executed = await page.evaluate(() => {
      const script = document.createElement("script");
      script.textContent = "document.documentElement.dataset.xss = 'ran'";
      document.body.append(script);
      return document.documentElement.dataset["xss"] === "ran";
    });

    expect(executed).toBe(false);
  });
});
