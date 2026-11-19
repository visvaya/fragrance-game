import { devices } from "@playwright/test";

import { expect, test } from "../support/fresh-player";

test.use({ ...devices["Pixel 5"] });

test("keeps the skip button in the centre of the status bar", async ({
  page,
}) => {
  // The attempt counter and the score have different widths ("1 / 6" against "1000", later
  // "700"); the skip button must not move when they change.
  await page.goto("/en");

  const bar = page.getByTestId("game-status-bar");
  const skip = page.getByRole("button", { name: "Skip this attempt" });
  await expect(skip).toBeVisible();

  const barBox = await bar.boundingBox();
  const skipBox = await skip.boundingBox();
  expect(barBox).not.toBeNull();
  expect(skipBox).not.toBeNull();

  const barCentre = (barBox?.x ?? 0) + (barBox?.width ?? 0) / 2;
  const skipCentre = (skipBox?.x ?? 0) + (skipBox?.width ?? 0) / 2;
  expect(Math.abs(skipCentre - barCentre)).toBeLessThan(1);
});
