import { test, expect } from "@playwright/test";

test.describe("Diagnostic - Selector Testing", () => {
  test("check multiple selectors for game input", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for page to fully load
    await page.waitForTimeout(5000);

    console.log("=== DIAGNOSTIC TEST ===");

    // Try different selectors
    const selectors = [
      { locator: page.getByTestId("game-input"), name: "getByTestId" },
      { locator: page.getByRole("combobox"), name: "getByRole(combobox)" },
      {
        locator: page.locator('[data-testid="game-input"]'),
        name: "locator[data-testid]",
      },
      { locator: page.locator("input").first(), name: "locator(input)" },
      {
        locator: page.getByPlaceholder(/guess|fragrance/i),
        name: "getByPlaceholder",
      },
    ];

    for (const { locator, name } of selectors) {
      const count = await locator.count();
      const isVisible = count > 0 ? await locator.first().isVisible() : false;

      console.log(`${name}: count=${count}, visible=${isVisible}`);

      if (count > 0) {
        try {
          const value = await locator.first().inputValue();
          console.log(`  value="${value}"`);
        } catch {
          console.log("  (cannot get value)");
        }
      }
    }

    // Check page content
    const bodyText = await page.textContent("body");
    const hasNoPuzzle =
      bodyText?.includes("No puzzle") || bodyText?.includes("Brak zagadki");
    const hasClosed =
      bodyText?.includes("closed") || bodyText?.includes("zakończona");

    console.log(`Has "No puzzle": ${hasNoPuzzle}`);
    console.log(`Has "closed": ${hasClosed}`);

    // Take screenshot for manual inspection
    await page.screenshot({ path: "diagnostic-screenshot.png" });

    // This test always passes - it's just for diagnostics
    expect(true).toBe(true);
  });
});
