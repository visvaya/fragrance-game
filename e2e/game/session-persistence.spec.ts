import { guessFirstSuggestion } from "../support/guess";
import { expect, test } from "../support/fresh-player";

// Playing creates the player's game session in the database (the first guess starts it), so a
// guess must still be on the board after a reload on the same day. A fresh player keeps the
// guess away from the users other specs share.
test("should persist game state within same day", async ({ page }) => {
  // The first guess also creates the session, so allow more than the default 30 s.
  test.setTimeout(60_000);

  await page.goto("/en");
  await expect(page.getByTestId("game-input")).toBeVisible({
    timeout: 15_000,
  });

  // [data-attempt-row] uses display:contents (no bounding box), so count the visible
  // id="attempt-N" cells instead.
  const attemptCells = page.locator('[id^="attempt-"]');
  await guessFirstSuggestion(page, "Chanel");
  await expect(attemptCells).toHaveCount(1, { timeout: 30_000 });

  await page.reload();

  // A player without a stored session would start again with an empty board.
  await expect(attemptCells).toHaveCount(1, { timeout: 15_000 });
});
