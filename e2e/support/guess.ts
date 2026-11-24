import { expect, type Page } from "@playwright/test";

/** Types a brand and picks the first suggestion, retrying the fill until suggestions show. */
export async function guessFirstSuggestion(
  page: Page,
  brand: string,
): Promise<void> {
  const input = page.getByPlaceholder(/Guess the fragrance/i);
  const suggestions = page.getByRole("option");
  await expect(async () => {
    await input.fill(brand);
    await expect(suggestions.first()).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30_000 });
  await suggestions.first().click();
}
