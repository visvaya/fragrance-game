import { test, expect, type Page } from "@playwright/test";

/** Waits for the page to render and for its web fonts and images to finish loading. */
async function waitForAssets(page: Page): Promise<void> {
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await expect
    .poll(async () =>
      page.evaluate(() =>
        [...document.images].every((image) => image.complete),
      ),
    )
    .toBe(true);
}

test.describe("Visual Regression - Core Pages @visual", () => {
  test("Landing Page snapshot", async ({ page }) => {
    await page.goto("/en");
    await waitForAssets(page);
    await expect(page).toHaveScreenshot("landing-page.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
      timeout: 30_000,
    });
  });

  test("Game Page initial state snapshot", async ({ page }) => {
    await page.goto("/en");
    await waitForAssets(page);
    // We might have a dynamic daily perfume, so we might want to mask some parts
    // or just check the general layout
    await expect(page).toHaveScreenshot("game-page-initial.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
      timeout: 30_000,
    });
  });
});
