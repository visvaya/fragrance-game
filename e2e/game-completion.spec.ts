import { test, expect } from "@playwright/test";

test.describe("Game Completion Flows", () => {
  test("Victory Flow (Win)", async ({ page, request }) => {
    // 1. Fetch the correct answer from our dev-only API
    const response = await request.get("/api/test/daily-answer");

    if (!response.ok()) {
      console.log(
        `Skipping Win test: Could not fetch daily answer. Status: ${response.status()}`,
      );
      try {
        const body = await response.json();
        console.log("API Error Body:", body);
      } catch {
        console.log("Could not parse API error body");
      }

      test.skip(true, "Skipping due to missing daily answer (404/403).");
      return;
    }

    const answer = await response.json();
    console.log(`[TEST] Winning perfume is: ${answer.name} by ${answer.brand}`);

    // 2. Load Game
    page.on("console", (msg) => console.log(`[BROWSER WIN] ${msg.text()}`));
    await page.goto("/");

    // Wait for game initialization
    await expect(page.locator(".animate-spin")).not.toBeVisible({
      timeout: 30_000,
    });

    if (
      await page.getByText(/Gra zakończona|Come back tomorrow/i).isVisible()
    ) {
      test.skip(true, "Game is closed.");
      return;
    }

    // 3. Input the correct answer
    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );
    await input.fill(answer.name);

    // 4. Select from suggestions
    // 4. Select from suggestions based on ID (robust)
    const suggestions = page.locator('button[class*="text-left text-sm"]');
    await expect(suggestions.first()).toBeVisible({ timeout: 10_000 });

    const targetSuggestion = page.locator(`button[data-perfume-id="${answer.id}"]`);

    // Fallback log
    if (!await targetSuggestion.isVisible()) {
      console.warn(`[TEST] Suggestion with ID ${answer.id} not found immediately. Dumping suggestions...`);
      const count = await suggestions.count();
      for (let i = 0; i < count; ++i) {
        console.log(`[TEST] Suggestion ${i}: "${await suggestions.nth(i).textContent()}"`);
      }
    }

    await expect(targetSuggestion).toBeVisible({ timeout: 5000 });
    await targetSuggestion.click({ force: true });

    // 5. Verify Win State
    await expect(page.getByText(/Magnifique!|Gratulacje/i)).toBeVisible({ timeout: 10_000 });
  });

  test("Defeat Flow (Loss)", async ({ page }) => {
    // Enable console logging from the browser to debug game state issues
    page.on("console", (msg) => console.log(`[BROWSER] ${msg.text()}`));

    await page.goto("/");

    if (
      await page.getByText(/Gra zakończona|Come back tomorrow/i).isVisible()
    ) {
      test.skip(true, "Game is closed.");
      return;
    }

    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );

    // Wait for game initialization
    await expect(page.locator(".animate-spin")).not.toBeVisible({
      timeout: 30_000,
    });

    // Use distinct global brands to ensure we pick DIFFERENT perfumes every time
    // This avoids the "Duplicate Guess" prevention logic
    const queries = ["Chanel", "Dior", "Gucci", "Versace", "YSL", "Armani"];

    for (let i = 0; i < 6; i++) {
      const query = queries[i];

      // Ensure input is empty before typing
      await input.fill("");
      await input.fill(query);

      // Wait for suggestions
      const suggestions = page.locator('button[class*="text-left text-sm"]');
      await expect(suggestions.first()).toBeVisible({ timeout: 5000 });

      // Click the FIRST suggestion for this distinct brand
      const suggestion = suggestions.first();
      await expect(suggestion).toBeVisible();
      const suggestionText = await suggestion.textContent();
      console.log(
        `[LOSS FLOW ${i + 1}] Clicking suggestion: "${suggestionText}" (Query: ${query})`,
      );

      await suggestion.click({ force: true });

      // Wait for input to be cleared (signal that guess was processed)
      try {
        await expect(input).toHaveValue("", { timeout: 3000 });
      } catch {
        console.log(
          `[WARN] Input not cleared on attempt ${i + 1} ("${query}"). Retrying click...`,
        );
        // Retry click just in case
        await suggestions.first().click({ force: true });
        await expect(input).toHaveValue("", { timeout: 3000 });
      }

      // Wait a beat to ensure state update
      await page.waitForTimeout(500);
    }

    // 6. Verify Loss State
    // Text comes from messages/en.json ("The answer was...") or pl.json ("Odpowiedź to...")
    // 6. Verify Loss State
    // Check for the "Closed" message in the input area
    await expect(page.getByText(/Wróć jutro po kolejną zagadkę!|Come back tomorrow for new essence.../i)).toBeVisible(
      { timeout: 10_000 },
    );

    const showAnswerButton = page.getByText(/Pokaż rozwiązanie|Show Answer/i);
    if (await showAnswerButton.isVisible()) {
      await showAnswerButton.click();
      await expect(page.locator(".text-brand-gold-500").first()).toBeVisible();
    }
  });
});
