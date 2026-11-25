import { expect, type Locator } from "@playwright/test";

/**
 * Waits until React has hydrated the element. Server HTML is visible before its handlers exist: text
 * typed into an input then is reset by hydration, and a click on a form button submits the form
 * natively and reloads the page. React marks a hydrated element with a `__reactFiber` property.
 */
export async function expectHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(
      async () =>
        locator.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactFiber")),
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
}
