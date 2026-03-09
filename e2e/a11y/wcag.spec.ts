import { AxeBuilder } from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * Automated accessibility tests (WCAG 2.1) for key pages.
 * We use `@axe-core/playwright` to audit the rendered DOM.
 */
test("homepage should have no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");

  // Wait for the main element to load
  await expect(page.locator("main")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("game page should have no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/game");
  await expect(page.locator("main")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("login modal should be accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();

  // Click the login button
  const loginButton = page.getByRole("button", { name: /Zaloguj|Login/i });
  await expect(loginButton).toBeVisible();
  await loginButton.click();
  // Wait for the modal to become visible (and its animation)
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]') // Focus only on the modal
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
