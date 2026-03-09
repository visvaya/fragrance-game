import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Eauxle/);
});

test("should not show reset button in production", async ({ page }) => {
  await page.goto("/");

  // Determine if we are in production mode
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // In production, the "Reset" button should NOT be visible to users
    const resetButton = page.getByRole("button", { name: /reset/i });
    await expect(resetButton).toBeHidden();
  }

  // Assertion: The main content should always be visible
  await expect(page.locator("main")).toBeVisible();
});
