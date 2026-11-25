import {
  expect,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";

/** A server action call: a POST to the page carrying the `next-action` header. */
export function isServerAction(request: Request): boolean {
  return request.method() === "POST" && "next-action" in request.headers();
}

/** Autocomplete icon state: search, loading, error or wrong. */
export function inputIcon(page: Page): Locator {
  return page.getByTestId("input-icon");
}

/**
 * Types into the autocomplete input and waits until its debounced search has been answered and the
 * input is back to the idle search icon, so the suggestion list shows the final result.
 */
export async function fillAndSearch(
  page: Page,
  input: Locator,
  text: string,
): Promise<void> {
  const searched = page.waitForResponse((response) =>
    isServerAction(response.request()),
  );
  await input.fill(text);
  await searched;
  await expect(inputIcon(page)).toHaveAttribute("data-icon", "search");
}
