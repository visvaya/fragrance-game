import { loadSupabaseAdminConfig } from "./global-setup";
import {
  createE2eAdminClient,
  type DailyAnswer,
  fetchDailyAnswer,
} from "./support/admin";
import { guessFirstSuggestion } from "./support/guess";
import { expect, test } from "./support/fresh-player";

const GAME_OVER_TEXT = /The answer was\.\.\.|Odpowiedź to\.\.\./i;
// Six distinct brands give six different perfumes; the sixth guess ends the game.
const FIRST_FIVE_BRANDS = ["Dior", "Chanel", "Gucci", "Versace", "Prada"];
const LAST_BRAND = "Hermes";

/** Today's answer, read with the service role key (UTC date, like the daily cron). */
async function todaysAnswer(): Promise<DailyAnswer> {
  const config = loadSupabaseAdminConfig();
  if (!config) throw new Error("Missing Supabase admin configuration");
  return fetchDailyAnswer(
    createE2eAdminClient(config),
    new Date().toISOString().slice(0, 10),
  );
}

test.describe("Game Completion Flows", () => {
  // Six guesses with server round trips take longer than the default 30 s.
  test.setTimeout(90_000);

  test("Victory Flow (Win)", async ({ page }) => {
    const answer = await todaysAnswer();

    await page.goto("/en");
    const input = page.getByPlaceholder(/Guess the fragrance/i);
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill(answer.name);

    const target = page
      .getByRole("option")
      .filter({ hasText: answer.brand })
      .filter({ hasText: answer.name })
      .first();
    await expect(target).toBeVisible({ timeout: 15_000 });
    await target.click();

    await expect(page.getByText("Magnifique!")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Defeat Flow (Loss)", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const input = page.getByPlaceholder(/Guess the fragrance/i);
    // [data-attempt-row] uses display:contents (no bounding box), so count the visible
    // id="attempt-N" cells instead.
    const attemptCells = page.locator('[id^="attempt-"]');

    for (const [index, brand] of FIRST_FIVE_BRANDS.entries()) {
      await guessFirstSuggestion(page, brand);
      // The first guess also creates the session (initializeAndGuess), so allow 30 s.
      await expect(attemptCells).toHaveCount(index + 1, { timeout: 30_000 });
      await expect(input).toHaveValue("", { timeout: 5000 });
    }
    await guessFirstSuggestion(page, LAST_BRAND);

    await expect(page.getByText(GAME_OVER_TEXT)).toBeVisible({
      timeout: 30_000,
    });
  });
});
