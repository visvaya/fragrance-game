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
  test.skip(
    await noPuzzle.isVisible(),
    "No puzzle for today; nothing to guess.",
  );

  await input.fill("Chanel");
  const suggestions = page.locator('[role="option"]');
  await expect(
    suggestions.first(),
    "autocomplete returned no suggestions",
  ).toBeVisible({ timeout: 15_000 });
  await suggestions.first().click();

  // The first row of the attempt log is numbered with the Roman numeral I.
  await expect(
    page.locator("span", { hasText: /^I$/ }).first(),
    "the guess did not reach the attempt log",
  ).toBeVisible({
    timeout: 15_000,
  });
});
