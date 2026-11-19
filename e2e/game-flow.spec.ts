import { existsSync } from "node:fs";
import path from "node:path";

import { test, expect } from "@playwright/test";

// Use a SEPARATE pre-authenticated user (game-flow user, not the primary user).
// Keeps game-flow's guess submissions isolated from game-completion's 6-attempt counter.
// Without storageState, signInAnonymously() + Turnstile captcha blocks guess submission.
// Playwright runs from the project root and loads specs as CommonJS; import.meta
// would make Node parse the file as an ES module ("exports is not defined").
const DIR = path.join(process.cwd(), "e2e");
const AUTH_FILE_GAMEFLOW = path.join(DIR, ".auth", "user-gameflow.json");
if (existsSync(AUTH_FILE_GAMEFLOW)) {
  test.use({ storageState: AUTH_FILE_GAMEFLOW });
}

test("a guess picked from the suggestions is logged as the first attempt", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const input = page.getByPlaceholder(
    /Guess the fragrance|Napisz jakie to perfumy/i,
  );
  await expect(input).toBeVisible({ timeout: 10_000 });

  // Three or more characters start the search; the catalogue has many Chanel perfumes.
  await input.fill("Chanel");
  const suggestions = page.locator('[role="option"]');
  await expect(suggestions.first()).toBeVisible({ timeout: 10_000 });
  await suggestions.first().click();

  // The attempt log numbers attempts with Roman numerals.
  await expect(page.locator("span", { hasText: /^I$/ }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(input).toHaveValue("");
});
