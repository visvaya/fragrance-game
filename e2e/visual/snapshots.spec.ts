import { test, expect } from "@playwright/test";

test.describe("Visual Regression - Core Pages @visual", () => {
  test("Landing Page snapshot", async ({ page }) => {
    await page.goto("/");
    // Wait for fonts/images
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("landing-page.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test("Game Page initial state snapshot", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // We might have a dynamic daily perfume, so we might want to mask some parts
    // or just check the general layout
    await expect(page).toHaveScreenshot("game-page-initial.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });
});
