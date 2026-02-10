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

    test('Game Input is accessible', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check for the input field where users type perfume names
        const inputField = page.getByTestId('game-input');

        try {
            await expect(inputField).toBeVisible({ timeout: 30000 });
        } catch (error) {
            await page.screenshot({ path: 'smoke-test-failure.png', fullPage: true });
            throw error;
        }
    });
});
