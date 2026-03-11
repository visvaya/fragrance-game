/* eslint-disable playwright/no-wait-for-timeout, playwright/no-networkidle -- diagnostic tests require explicit waits and networkidle for full error state capture */
import { test, expect } from "@playwright/test";

/**
 * Diagnostic - Global Selector & State Testing
 * This test is designed to verify the presence and visibility of key elements
 * across different game states (Active, Closed, No Puzzle).
 */
test.describe("Global Game Diagnostics", () => {
  test("audit game input and interactive elements", async ({ page }) => {
    // Navigate to English version for consistent selectors
    await page.goto("/en", { waitUntil: "networkidle" });

    // Wait a bit for Supabase/Hydration
    await page.waitForTimeout(3000);

    console.log("\n=== START DIAGNOSTIC AUDIT ===");

    // 1. Check for State Messages
    const bodyTextContent = (await page.textContent("body")) ?? "";
    const isClosedState =
      bodyTextContent.includes("Gra zakończona") ||
      bodyTextContent.includes("Come back tomorrow");
    const isNoPuzzleState =
      bodyTextContent.includes("No puzzle today") ||
      bodyTextContent.includes("Brak zagadki");

    console.log(
      `Current State: isClosed=${isClosedState}, isNoPuzzle=${isNoPuzzleState}`,
    );

    // 2. Audit Selectors (even if inactive, to see if they exist in DOM)
    const selectorsToAudit = [
      {
        locator: page.getByPlaceholder(/Guess the fragrance/i),
        name: "Placeholder (EN)",
      },
      {
        locator: page.getByPlaceholder(/Napisz jakie to perfumy/i),
        name: "Placeholder (PL)",
      },
      {
        locator: page.locator('[data-testid="game-input"]'),
        name: "Test ID: game-input",
      },
      {
        locator: page.locator('input[type="text"]').first(),
        name: "First Text Input",
      },
      { locator: page.getByRole("combobox"), name: "Role: combobox" },
    ];

    for (const { locator, name } of selectorsToAudit) {
      const count = await locator.count();
      const isVisibleInDom = count > 0 && (await locator.first().isVisible());
      console.log(
        `[Selector] ${name}: count=${count}, visible=${isVisibleInDom}`,
      );
    }

    // 3. Take Diagnostic Screenshot
    const screenshotFilePath = "reports/diagnostic-audit.png";
    await page.screenshot({ fullPage: true, path: screenshotFilePath });
    console.log(`Screenshot saved to: ${screenshotFilePath}`);

    // 4. Validate core layout presence
    await expect(page.locator("main")).toBeVisible();

    // If we are NOT in a closed/no-puzzle state, the input SHOULD be visible
    if (!isClosedState && !isNoPuzzleState) {
      const inputField = page.getByPlaceholder(
        /Guess the fragrance|Napisz jakie to perfumy/i,
      );
      // Liberal timeout for CI
      await expect(inputField).toBeVisible({ timeout: 10_000 });
    }

    console.log("=== END DIAGNOSTIC AUDIT ===\n");
  });

  test("verify Content Security Policy (CSP) presence", async ({ page }) => {
    const response = await page.goto("/en");
    expect(response).not.toBeNull();

    if (response) {
      const currentCsp = response.headers()["content-security-policy"];
      console.log(
        `CSP Header: ${currentCsp ? "PRESENCE DETECTED" : "MISSING!"}`,
      );
      expect(currentCsp).toBeTruthy();
    }
  });
});
