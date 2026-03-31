import { existsSync } from "fs";
import path from "path";
import { AxeBuilder } from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// Dedicated a11y user — fresh game state, never played.
// Using a separate user prevents game-completion Defeat test (same parallel run)
// from exhausting 6 attempts on the primary user before a11y tests see the game page.
// Without storageState, signInAnonymously() fails → Turnstile overlay blocks all clicks.
const AUTH_FILE_A11Y = path.join(__dirname, "..", ".auth", "user-a11y.json");
if (existsSync(AUTH_FILE_A11Y)) {
  test.use({ storageState: AUTH_FILE_A11Y });
}

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
  await page.goto("/en");
  await expect(page.locator("main")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("login modal should be accessible", async ({ page }) => {
  // Use explicit locale to ensure consistent translations (Sign In, not Zaloguj się)
  await page.goto("/en");
  await expect(page.locator("main")).toBeVisible();

  // Open the navigation menu first (Sign In is inside the menu dropdown)
  const menuButton = page.locator('button[aria-label="Menu"]');
  await expect(menuButton).toBeVisible({ timeout: 10_000 });
  await menuButton.click();

  // Wait for Sign In button to appear in the dropdown (dropdown uses CSS transition ~300ms)
  // The dropdown container is aria-hidden when closed and visible to AT when open.
  const signInButton = page.getByRole("button", { name: "Sign In" }).first();
  await expect(signInButton).toBeVisible({ timeout: 10_000 });
  await signInButton.click();

  // Wait for the auth modal to fully open.
  // We use [data-slot="dialog-content"] to specifically target the AuthModal's Dialog,
  // avoiding the Next.js dev error overlay which also has role="dialog".
  const authModal = page.locator('[data-slot="dialog-content"]');
  await expect(authModal).toBeVisible({ timeout: 10_000 });

  // Scan the full page while the modal is open. Tests 1 and 2 already verify the base
  // page has no violations; any violations here would be introduced by the open modal.
  // We avoid .include('[data-slot="dialog-content"]') because axe throws if the element
  // detaches from the DOM during the async scan (e.g. during closing animation).
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
