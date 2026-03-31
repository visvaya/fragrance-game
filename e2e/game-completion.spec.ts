import { existsSync } from "fs";
import path from "path";
import { expect, test } from "@playwright/test";

// Auth file created by globalSetup (e2e/global-setup.ts) before tests run.
// Contains pre-authenticated anonymous Supabase session (bypasses Turnstile captcha).
const AUTH_FILE = path.join(__dirname, ".auth", "user.json");

test.describe("Game Completion Flows", () => {
  // Use pre-authenticated session if globalSetup created it.
  // This ensures authReady=true from the start — no signInAnonymously() needed.
  if (existsSync(AUTH_FILE)) {
    test.use({ storageState: AUTH_FILE });
  }

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

    console.log(
      `[TEST] Winning perfume is: ${perfume.name} by ${perfume.brand}`,
    );

    // 3. Handle game already finished or no puzzle state
    const isNoPuzzle = await page
      .getByText(/No puzzle today|Brak zagadki na dziś/i)
      .isVisible();

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
    await input.click();
    await input.fill(perfume.brand);

    // 5. Wait for suggestions and select the CORRECT one
    // We filter by both name and brand for maximum precision
    const suggestions = page.getByRole("option");

    // Wait for at least one suggestion to be visible
    await expect(suggestions.first()).toBeVisible({ timeout: 15_000 });

    // Filter suggestions to find the one containing BOTH perfume name and brand
    const targetSuggestion = suggestions
      .filter({
        hasText: perfume.brand,
      })
      .filter({
        hasText: perfume.name,
      });

    if ((await targetSuggestion.count()) === 0) {
      console.log(
        `[WARN] Perfect match not found for "${perfume.name}" by "${perfume.brand}". Picking first suggestion.`,
      );
      await suggestions.first().click();
    } else {
      console.log(`[TEST] Found matching suggestion for "${perfume.name}"`);
      await targetSuggestion.first().click();
    }

    // 6. Verify Win State
    await expect(page.getByText("Magnifique!")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Defeat Flow (Loss)", async ({ page }) => {
    // 1. Visit Home — same strategy as game-flow.spec.ts which handles captcha reload
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // 2. Check if already finished or no puzzle
    const closedMessage = page.getByText(
      /Gra zakończona|Come back tomorrow|No puzzle today|Brak zagadki na dziś/i,
    );
    if (await closedMessage.isVisible()) {
      console.log("[SKIP] Game is closed or no puzzle today.");
      return;
    }

    const isGameOver = await page
      .getByText(/Magnifique!|The answer was\.\.\.|Odpowiedź to\.\.\./i)
      .isVisible();

    if (isGameOver) {
      console.log("[SKIP] Game already finished, cannot test loss flow");
      return;
    }

    const input = page.getByPlaceholder(
      /Guess the fragrance|Napisz jakie to perfumy/i,
    );

    // Use 6 distinct brands to ensure we get 6 DIFFERENT perfumes easily
    const brands = ["Dior", "Chanel", "Gucci", "Versace", "Prada", "Hermes"];

    // [data-attempt-row] uses display:contents (no bounding box) — Playwright's toHaveCount skips it.
    // Use id="attempt-N" (the visible RowCell inside each attempt row) as the reliable indicator.
    const attemptCells = page.locator('[id^="attempt-"]');

    for (let i = 0; i < 6; i++) {
      const brand = brands[i];
      const expectedCellCount = i + 1;
      const suggestions = page.getByRole("option");

      // Retry-safe: if a captcha-triggered page reload happens mid-fill, re-fill on next retry.
      // toPass() retries the whole block until suggestions appear.
      await expect(async () => {
        await input.click();
        await input.clear();
        await input.fill(brand);
        await expect(suggestions.first()).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 30_000 });

      const suggestion = suggestions.first();
      const suggestionText = await suggestion.textContent();
      console.log(`[LOSS FLOW ${i + 1}] Guessing: "${suggestionText}"`);

      await suggestion.click();

      if (i < 5) {
        // Wait for the attempt cell to appear — confirms auth + guess submission completed
        // First guess triggers initializeAndGuess() (session + submit in 1 roundtrip) — allow 30s
        await expect(attemptCells).toHaveCount(expectedCellCount, {
          timeout: 30_000,
        });
        await expect(input).toHaveValue("", { timeout: 5_000 });
      } else {
        // For 6th attempt: wait for either game over message or cell count
        await expect(async () => {
          const isFinished = await page
            .getByText(/Magnifique!|The answer was\.\.\.|Odpowiedź to\.\.\./i)
            .isVisible();
          const cellCount = await attemptCells.count();

          expect(isFinished || cellCount >= 6).toBeTruthy();
        }).toPass({ timeout: 30_000 });
      }
    }

    // 6. Verify Loss State
    await expect(
      page.getByText(/The answer was\.\.\.|Odpowiedź to\.\.\./i),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});
