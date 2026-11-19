import { test, expect } from "@playwright/test";

test.describe("Smoke Tests - Critical Path @smoke", () => {
  test("Landing Page loads correctly", async ({ page }) => {
    await page.goto("/");

    // Check for title or key element
    await expect(page).toHaveTitle(/Eauxle|Fragrance/i);

    // Game starts immediately, so check for game container
    const gameContainer = page.locator("main");
    await expect(gameContainer).toBeVisible();
  });

  test("Game page is in the first HTML, not in a streamed Suspense fallback", async ({
    request,
  }) => {
    // Content streamed behind a fallback is painted only after hydration, which delayed the
    // largest contentful paint (the perfume image) by seconds on slow phones.
    // React streams such content as <div hidden id="S:n"> and swaps it in later.
    const html = await (await request.get("/en")).text();

    // The clue panel title renders with and without a daily puzzle.
    expect(html).toContain(">Identity<");
    expect(html).not.toMatch(/<div hidden id="S:/);
  });

  test("Unknown page answers 404 with the localized not-found page", async ({
    page,
  }) => {
    const response = await page.goto("/en/no-such-page");

    expect(response?.status()).toBe(404);
    await expect(page.getByText("404 - Not Found")).toBeVisible();
  });

  test("Game Input or No-Puzzle message is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();

    // Resilience: check for input OR "no puzzle" message
    const inputField = page.getByTestId("game-input");
    const noPuzzleMessage = page.locator(
      "text=/No puzzle today|Come back tomorrow|Brak puzzli|Wróć jutro/i",
    );

    await expect(async () => {
      const isInputVisible = await inputField.isVisible();
      const isMessageVisible = await noPuzzleMessage.isVisible();
      expect(isInputVisible || isMessageVisible).toBeTruthy();
    }).toPass({ timeout: 15_000 });
  });
});
