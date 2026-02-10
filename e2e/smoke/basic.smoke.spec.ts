import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Critical Path @smoke', () => {
    test('Landing Page loads correctly', async ({ page }) => {
        await page.goto('/');

        // Check for title or key element
        await expect(page).toHaveTitle(/Eauxle|Fragrance/i);

        // Game starts immediately, so check for game container
        const gameContainer = page.locator('main');
        await expect(gameContainer).toBeVisible();
    });

    test('Game Input or No-Puzzle message is visible', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Resilience: check for input OR "no puzzle" message
        const inputField = page.getByTestId('game-input');
        const noPuzzleMsg = page.locator('text=/No puzzle today|Come back tomorrow|Brak puzzli|Wróć jutro/i');

        await expect(async () => {
            const isInputVisible = await inputField.isVisible();
            const isMsgVisible = await noPuzzleMsg.isVisible();
            expect(isInputVisible || isMsgVisible).toBeTruthy();
        }).toPass({ timeout: 15000 });

        if (await noPuzzleMsg.isVisible()) {
            console.log('Smoke test note: Application is running, but no puzzle detected for current date/timezone.');
        }
    });
});
