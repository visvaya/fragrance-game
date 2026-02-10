import { expect, test } from "@playwright/test";

test.describe("Game Completion Flows", () => {
  // Skip these tests in CI environment to avoid flakiness and save resources
  test.skip(!!process.env.CI, "Skipping game completion flows in CI");

  // Increase timeout for these tests (default 30s is too short for 6 attempts)
  test.setTimeout(90_000);


  test("Victory Flow (Win)", async ({ page }) => {
    // 1. Visit Home
    await page.goto("/");

    // 2. Identify the target perfume using the test API
    // (This is allowed on CI check app/api/test/daily-answer/route.ts)
    const response = await page.request.get("/api/test/daily-answer");

    if (response.status() === 403 || response.status() === 404) {
      console.log("[SKIP] Test API not available, skipping Victory flow");
      return;
    }

    const { perfume } = await response.json();
    if (!perfume) {
      console.log("[SKIP] No puzzle available today, skipping Victory flow");
      return;
    }

    console.log(`[TEST] Winning perfume is: ${perfume.name} by ${perfume.brand}`);

    // 3. Handle game already finished or no puzzle state
    const isNoPuzzle = await page.getByText(/No puzzle today|Brak zagadki na dziś/i).isVisible();
    if (isNoPuzzle) {
      console.log("[SKIP] No puzzle available today, skipping Victory flow");
      return;
    }

    const isGameOver = await page
      .getByText(/Magnifique!|The answer was\.\.\.|Odpowiedź to\.\.\./i)
      .isVisible();
    if (isGameOver) {
      console.log("[SKIP] Game already finished for today");
      return;
    }

    // 4. Type brand to get suggestions
    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );

    // Ensure input is visible and enabled
    await expect(input).toBeVisible({ timeout: 15_000 });

    // Focus and Type brand
    await input.click({ force: true });
    await input.fill(perfume.brand);

    // 5. Wait for suggestions and select the CORRECT one
    // We filter by both name and brand for maximum precision
    const suggestions = page.getByRole("option");

    // Wait for at least one suggestion to be visible
    await expect(suggestions.first()).toBeVisible({ timeout: 15_000 });

    // Filter suggestions to find the one containing BOTH perfume name and brand
    const targetSuggestion = suggestions.filter({
      hasText: perfume.brand,
    }).filter({
      hasText: perfume.name,
    });

    if ((await targetSuggestion.count()) === 0) {
      console.log(
        `[WARN] Perfect match not found for "${perfume.name}" by "${perfume.brand}". Picking first suggestion.`,
      );
      await suggestions.first().click({ force: true });
    } else {
      console.log(`[TEST] Found matching suggestion for "${perfume.name}"`);
      await targetSuggestion.first().click({ force: true });
    }

    // 6. Verify Win State
    await expect(page.getByText("Magnifique!")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Defeat Flow (Loss)", async ({ page }) => {
    // 1. Visit Home
    await page.goto("/");

    // 2. Check if already finished or no puzzle
    const isNoPuzzle = await page.getByText(/No puzzle today|Brak zagadki na dziś/i).isVisible();
    if (isNoPuzzle) {
      console.log("[SKIP] No puzzle available today, cannot test loss flow");
      return;
    }

    const isGameOver = await page
      .getByText(/Magnifique!|The answer was\.\.\.|Odpowiedź to\.\.\./i)
      .isVisible();
    if (isGameOver) {
      console.log("[SKIP] Game already finished, cannot test loss flow");
      return;
    }

    // 3. Make 6 WRONG guesses
    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );

    // Ensure input is visible and enabled
    await expect(input).toBeVisible({ timeout: 15_000 });

    // Use 6 distinct brands to ensure we get 6 DIFFERENT perfumes easily
    const brands = ["Dior", "Chanel", "Gucci", "Versace", "Prada", "Hermes"];

    for (let i = 0; i < 6; i++) {
      const brand = brands[i];

      // Ensure input is focused
      await input.click({ force: true });
      await input.clear();

      // Type the brand name
      await input.fill(brand);

      const suggestions = page.getByRole("option");

      // Wait for suggestions to appear
      await expect(suggestions.first()).toBeVisible({ timeout: 7_000 });

      const suggestion = suggestions.first();
      const suggestionText = await suggestion.textContent();
      console.log(`[LOSS FLOW ${i + 1}] Guessing: "${suggestionText}"`);

      if (i < 5) {
        // For first 5 attempts: simple click and verify cleared input
        await suggestion.click({ force: true });
        await expect(input).toHaveValue("", { timeout: 3_000 });
      } else {
        // For 6th attempt: use retry logic to handle game over transition
        await expect(async () => {
          await suggestion.click({ force: true });

          const isFinished = await page
            .getByText(/Magnifique!|The answer was\.\.\.|Odpowiedź to\.\.\./i)
            .isVisible();
          const inputVisible = await input.isVisible();

          expect(isFinished || !inputVisible).toBeTruthy();
        }).toPass({ timeout: 8_000 });
      }

      await page.waitForTimeout(100);
    }

    // 6. Verify Loss State
    await expect(
      page.getByText(/The answer was\.\.\.|Odpowiedź to\.\.\./i),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});
