import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Eauxle/);
});

test("does not show the debug reset button to players", async ({ page }) => {
  test.skip(
    process.env.NEXT_PUBLIC_GAME_RESET_ENABLED === "true",
    "this build enables the debug reset button",
  );
  await page.goto("/");

  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("button", { name: /reset/i })).toBeHidden();
});
