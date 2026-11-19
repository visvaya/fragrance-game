import { test, expect, type Response } from "@playwright/test";

type ViolationWindow = Window & { cspViolations?: string[] };
// The root layout's blocking preference scripts: layout width, theme and text size.
const LAYOUT_INLINE_SCRIPTS = 3;

/** The nonce in a response's Content-Security-Policy header, if any. */
function cspNonceOf(response: Response | null): string | undefined {
  const policy = response?.headers()["content-security-policy"] ?? "";
  return /'nonce-([^']+)'/.exec(policy)?.[1];
}

test.describe("Content Security Policy @smoke", () => {
  // In a dark color scheme the layout's theme script adds the dark class before first paint.
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
      const nonce = cspNonceOf(await page.goto(path));

      // The provider also adds the dark class after hydration, so check the layout's inline
      // scripts carry this response's nonce: without it they are blocked and the theme flashes.
      expect(nonce).toMatch(/^[A-Z0-9+/=]{16,}$/i);
      const headScriptNonces = await page
        .locator("head script:not([src])")
        .evaluateAll((scripts) =>
          scripts.map((script) => (script as HTMLScriptElement).nonce),
        );
      expect(headScriptNonces).toHaveLength(LAYOUT_INLINE_SCRIPTS);
      expect(new Set(headScriptNonces)).toEqual(new Set([nonce]));
      await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      const violations = await page.evaluate(
        () => (globalThis as unknown as ViolationWindow).cspViolations,
      );
      expect(violations).toEqual([]);
    });
  }

  // The classic injection: markup with an inline event handler reaching innerHTML. The policy
  // has no 'unsafe-inline', so the handler must not run. (A script element created from JS is
  // not a valid probe: 'strict-dynamic' trusts scripts that running scripts add.)
  test("blocks an inline event handler injected into the page", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const executed = await page.evaluate(async () => {
      const holder = document.createElement("div");
      holder.innerHTML = `<img src="/no-such-image.png" onerror="document.documentElement.dataset.xss='ran'">`;
      const image = holder.querySelector("img");
      const failed = new Promise((resolve) => {
        image?.addEventListener("error", resolve, { once: true });
      });
      document.body.append(holder);
      await failed;
      // The attribute handler, if allowed, runs before this listener; wait one more task anyway.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return document.documentElement.dataset["xss"] === "ran";
    });

    expect(executed).toBe(false);
  });
});
