import { loadSupabaseAdminConfig } from "../global-setup";
import {
  createE2eAdminClient,
  type DailyAnswer,
  fetchDailyAnswer,
} from "../support/admin";
import { expect, test } from "../support/fresh-player";

import type { Page, Request } from "@playwright/test";

const NO_RESULTS_TEXT = /No results found/i;

/** Today's answer, read with the service role key (UTC date, like the daily cron). */
async function todaysAnswer(): Promise<DailyAnswer> {
  const config = loadSupabaseAdminConfig();
  if (!config) throw new Error("Missing Supabase admin configuration");
  return fetchDailyAnswer(
    createE2eAdminClient(config),
    new Date().toISOString().slice(0, 10),
  );
}

/**
 * Returns the autocomplete input once React has hydrated it. The input is in the server HTML,
 * so it is visible before its handlers exist; text typed then is reset by hydration and starts
 * no search. React marks a hydrated element with a `__reactFiber` property.
 */
async function hydratedInput(page: Page) {
  const input = page.getByTestId("game-input");
  await expect(input).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(
      async () =>
        input.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactFiber")),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  return input;
}

/** Opens the game and returns the autocomplete input once it is ready for typing. */
async function openGame(page: Page) {
  await page.goto("/en");
  return hydratedInput(page);
}

/** Autocomplete icon state: search, loading, error or wrong. */
function inputIcon(page: Page) {
  return page.getByTestId("input-icon");
}

/** A server action call: a POST to the page carrying the `next-action` header. */
function isServerAction(request: Request): boolean {
  return request.method() === "POST" && "next-action" in request.headers();
}

/** Answers every server action call with a 500 and lets other requests through. */
async function failServerActions(page: Page): Promise<void> {
  await page.route("**/en", async (route) =>
    isServerAction(route.request())
      ? route.fulfill({ body: "boom", status: 500 })
      : route.fallback(),
  );
}

test.describe("Error Handling", () => {
  test.describe("Network Errors", () => {
    // Failures are forced by answering the search's server action with a 500. Browser offline mode
    // (context.setOffline) left the icon unchanged in some runs for a reason not found, so it is
    // not used.
    test("shows the error icon when the server action fails", async ({
      page,
    }) => {
      await failServerActions(page);
      const input = await openGame(page);

      await input.fill("Chanel");

      await expect(inputIcon(page)).toHaveAttribute("data-icon", "error");
      await expect(page.getByRole("option")).toHaveCount(0);
    });

    test("searches again once the server answers", async ({ page }) => {
      await failServerActions(page);
      const input = await openGame(page);
      await input.fill("Chanel");
      await expect(inputIcon(page)).toHaveAttribute("data-icon", "error");

      await page.unroute("**/en");
      await input.fill("Chane");

      await expect(page.getByRole("option").first()).toBeVisible();
      await expect(inputIcon(page)).toHaveAttribute("data-icon", "search");
    });
  });

  test.describe("Search Results", () => {
    test("shows 'no results' message when nothing matches", async ({
      page,
    }) => {
      const input = await openGame(page);

      // The search is fuzzy, so no text finds nothing; a query over the 100 character limit does.
      await input.fill("x".repeat(101));

      await expect(page.getByText(NO_RESULTS_TEXT)).toBeVisible();
    });

    test("shows suggestions for valid query", async ({ page }) => {
      const input = await openGame(page);

      await input.fill("Chanel");

      await expect(page.getByRole("option").first()).toBeVisible();
      await expect(page.getByText(NO_RESULTS_TEXT)).toBeHidden();
    });
  });

  test.describe("Duplicate Prevention", () => {
    test("prevents selecting already guessed perfume", async ({ page }) => {
      const answer = await todaysAnswer();
      const input = await openGame(page);

      await input.fill("Chan");
      // Not today's answer, so the guess is wrong and the game goes on.
      const firstOption = page
        .getByRole("option")
        .filter({ hasNotText: answer.name })
        .first();
      await expect(firstOption).toBeVisible();
      const perfumeId = await firstOption.getAttribute("data-perfume-id");
      await firstOption.click();
      await expect(page.locator("#attempt-0")).toBeVisible();

      await input.fill("Chan");
      const duplicate = page.locator(
        `[role="option"][data-perfume-id="${perfumeId}"]`,
      );
      await expect(duplicate).toBeDisabled();
      await expect(duplicate.locator(".line-through")).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("shows suggestions only from 3 characters", async ({ page }) => {
      const input = await openGame(page);

      for (const shortQuery of ["C", "Ch"]) {
        const searched = page.waitForRequest(isServerAction);
        await input.fill(shortQuery);
        await searched;
        await expect(inputIcon(page)).toHaveAttribute("data-icon", "search");
        await expect(page.getByRole("option")).toHaveCount(0);
      }

      await input.fill("Cha");
      await expect(page.getByRole("option").first()).toBeVisible();
    });
  });
});
