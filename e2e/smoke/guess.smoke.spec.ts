import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

// One real guess on the blocking smoke run: autocomplete must answer from the database and the guess
// must reach the attempt log. Uses the game-flow user that globalSetup creates through the Admin API
// (no Turnstile); the user is deleted in globalTeardown. Playwright loads specs as CommonJS, so paths
// start from process.cwd(), not import.meta.
const AUTH_FILE_GAMEFLOW = path.join(
  process.cwd(),
  "e2e",
  ".auth",
  "user-gameflow.json",
);
test.use({ storageState: AUTH_FILE_GAMEFLOW });
const SEEDED_STACK = ["127.0.0.1", "localhost"].includes(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://unset").hostname,
);

test("A player can make a guess @smoke", async ({ page }) => {
  test.setTimeout(60_000);
  expect(
    existsSync(AUTH_FILE_GAMEFLOW),
    "globalSetup did not create the game-flow session",
  ).toBe(true);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const input = page.getByTestId("game-input");
  const noPuzzle = page.locator(
    "text=/No puzzle today|Come back tomorrow|Brak puzzli|Wróć jutro/i",
  );
  await expect(input.or(noPuzzle).first()).toBeVisible({ timeout: 15_000 });
  // The local stack's seed always has today's puzzle, so there a missing one is a failure.
  expect(
    SEEDED_STACK && (await noPuzzle.isVisible()),
    "the seeded puzzle for today is missing",
  ).toBe(false);
  test.skip(
    await noPuzzle.isVisible(),
    "No puzzle for today; nothing to guess.",
  );

  // The attempt counter ("Attempt: 1 / 6", in Polish "Próba") moves on after a guess, or disappears
  // when the guess ends the game. The page renders it twice (two layouts), one of them hidden.
  const firstAttempt = page
    .getByText(/\b1\s*\/\s*6\b/)
    .filter({ visible: true });
  await expect(firstAttempt, "a fresh player starts at attempt 1").toHaveCount(
    1,
  );

  await input.fill("Chanel");
  const suggestions = page.locator('[role="option"]');
  await expect(
    suggestions.first(),
    "autocomplete returned no suggestions",
  ).toBeVisible({ timeout: 15_000 });
  await suggestions.first().click();

  await expect(firstAttempt, "the guess was not recorded").toHaveCount(0, {
    timeout: 15_000,
  });
});
