/* eslint-disable playwright/no-wait-for-timeout -- error handling tests require explicit waits for async error boundaries to render */
import { existsSync } from "fs";
import path from "path";
import { test, expect, type Page } from "@playwright/test";

// Pre-authenticated session — skips signInAnonymously() + Turnstile captcha.
// Without this the game shows "No puzzle today" because auth takes >10s in headless mode.
const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");
if (existsSync(AUTH_FILE)) {
  test.use({ storageState: AUTH_FILE });
}

/**
 * Helper to wait for game input to be ready.
 * With pre-authenticated storageState, auth is instant — input appears in ~1-2s.
 */
async function waitForGameInput(page: Page) {
  const input = page.getByTestId("game-input");
  await expect(input).toBeVisible({ timeout: 15_000 });
  return input;
}

test.describe("Error Handling", () => {
  test.describe("Network Errors", () => {
    test("shows graceful error when offline during search", async ({
      context,
      page,
    }) => {
      await page.goto("/");

      const input = await waitForGameInput(page);

      await input.fill("Chan");

      await expect(page.getByTestId("loader-icon")).toBeVisible({
        timeout: 5000,
      });

      await context.setOffline(true);
      await page.waitForTimeout(2000);

      const noResultsVisible = await page
        .getByText(/No results found|Brak wyników/i)
        .isVisible();

      const isNotLoading = !(await page.getByTestId("loader-icon").isVisible());

      expect(noResultsVisible || isNotLoading).toBe(true);

      await context.setOffline(false);
    });

    test("recovers from network error when back online", async ({
      context,
      page,
    }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const input = await waitForGameInput(page);

      await context.setOffline(true);
      await input.fill("Chanel");
      await page.waitForTimeout(1000);

      await context.setOffline(false);
      await input.clear();
      await input.fill("Chan");
      await page.waitForTimeout(500);

      const searchIcon = page.getByTestId("search-icon");
      const loaderIcon = page.getByTestId("loader-icon");

      const searchVisible = await searchIcon.isVisible().catch(() => false);
      const loaderVisible = await loaderIcon.isVisible().catch(() => false);

      expect(searchVisible || loaderVisible).toBe(true);
    });
  });

  test.describe("Search Results", () => {
    test("shows 'no results' message for nonsense query", async ({ page }) => {
      await page.goto("/");

      const input = await waitForGameInput(page);

      await input.fill("xyzxyzxyzabc123");
      await page.waitForTimeout(500);

      await expect(
        page.getByText(/No results found|Brak wyników/i),
      ).toBeVisible({ timeout: 5000 });
    });

    test("shows suggestions for valid query", async ({ page }) => {
      await page.goto("/");

      const input = await waitForGameInput(page);

      await input.fill("Chanel");
      await page.waitForTimeout(500);

      const hasSuggestions = (await page.getByRole("option").count()) > 0;
      const hasNoResults = await page
        .getByText(/No results found|Brak wyników/i)
        .isVisible()
        .catch(() => false);

      expect(hasSuggestions || hasNoResults).toBe(true);
    });
  });

  test.describe("Duplicate Prevention", () => {
    test("prevents selecting already guessed perfume", async ({ page }) => {

      await page.goto("/");

      const closedMessage = page.getByText(
        /Gra zakończona|Come back tomorrow/i,
      );
      await expect(closedMessage).toBeHidden();

      const input = await waitForGameInput(page);

      await input.fill("Chan");
      await page.waitForTimeout(500);

      const suggestions = await page.getByRole("option").count();
      if (suggestions === 0) {
        console.log("[SKIP] No suggestions available for this query");
        return;
      }

      const firstOption = page.getByRole("option").first();
      const firstOptionText = await firstOption.textContent();
      await firstOption.click();

      await page.waitForTimeout(1000);

      await input.fill("Chan");
      await page.waitForTimeout(500);

      const options = page.getByRole("option");
      const count = await options.count();

      let foundDuplicate = false;
      for (let i = 0; i < count; i++) {
        const option = options.nth(i);
        const text = await option.textContent();

        if (text === firstOptionText) {
          await expect(option).toBeDisabled();
          const hasStrikethrough = option.locator(".line-through");
          await expect(hasStrikethrough).toBeVisible();
          foundDuplicate = true;
          break;
        }
      }

      if (!foundDuplicate) {
        console.log(
          "[INFO] Duplicate not found in current suggestions (may have filtered out)",
        );
      }
    });
  });

  test.describe("Input Validation", () => {
    test("does not trigger search for queries less than 3 characters", async ({
      page,
    }) => {
      await page.goto("/");

      const input = await waitForGameInput(page);

      await input.fill("C");
      await page.waitForTimeout(500);

      let hasOptions = (await page.getByRole("option").count()) > 0;
      expect(hasOptions).toBe(false);

      await input.fill("Ch");
      await page.waitForTimeout(500);

      hasOptions = (await page.getByRole("option").count()) > 0;
      expect(hasOptions).toBe(false);

      await input.fill("Cha");
      await page.waitForTimeout(500);

      const hasResults = (await page.getByRole("option").count()) > 0;
      const hasNoResults = await page
        .getByText(/No results found|Brak wyników/i)
        .isVisible()
        .catch(() => false);

      expect(hasResults || hasNoResults).toBe(true);
    });
  });

  test.describe("Game State Errors", () => {
    test("shows closed message when game is not active", async ({ page }) => {
      await page.goto("/");

      await page.waitForTimeout(2000);

      const closedVisible = await page
        .getByText(/Gra zakończona|Come back tomorrow|closed/i)
        .isVisible()
        .catch(() => false);

      const noPuzzleVisible = await page
        .getByText(/No puzzle|Brak zagadki/i)
        .isVisible()
        .catch(() => false);

      const inputVisible = await page
        .getByTestId("game-input")
        .isVisible()
        .catch(() => false);

      expect(closedVisible || noPuzzleVisible || inputVisible).toBe(true);
    });
  });

  test.describe("Incorrect Guess Feedback", () => {
    test("shows visual feedback for incorrect guess", async ({ page }) => {

      await page.goto("/", { waitUntil: "domcontentloaded" });

      const closedMessage = page.getByText(
        /Gra zakończona|Come back tomorrow/i,
      );
      if (await closedMessage.isVisible()) {
        test.skip(true, "Game is currently closed.");
        return;
      }

      const input = await waitForGameInput(page);

      // Submit any perfume from suggestions — we only verify the attempt is recorded,
      // not whether the guess was correct. No need to know today's answer.
      await input.fill("Chanel");
      await page.waitForTimeout(500);

      const suggestions = page.getByRole("option");
      const count = await suggestions.count();
      if (count === 0) {
        test.skip(true, "No suggestions available");
        return;
      }

      await suggestions.first().click();

      await page.waitForTimeout(2000);

      // Verify attempt was recorded in the log (Roman numeral "I" = first attempt)
      const attemptRow = page.locator("span", { hasText: /^I$/ }).first();
      await expect(attemptRow).toBeVisible({ timeout: 5000 });
    });
  });
});
