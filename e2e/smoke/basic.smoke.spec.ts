import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Critical Path @smoke', () => {
    test('Landing Page loads correctly', async ({ page }) => {
        await page.goto('/');

        // Check for title or key element
        await expect(page).toHaveTitle(/Eauxle|Fragrance/i);

        // Check for the "Start Playing" or similar CTA
        const startButton = page.getByRole('link', { name: /Graj/i }).or(page.getByRole('button', { name: /Graj/i }));
        await expect(startButton).toBeVisible();
    });

    test('Game Page accessibility from Landing', async ({ page }) => {
        await page.goto('/');

        const startButton = page.getByRole('link', { name: /Graj/i }).or(page.getByRole('button', { name: /Graj/i }));
        await startButton.click();

        // Should navigate to /game or similar
        await expect(page).toHaveURL(/.*game/);

        // Check for game container or progress indicators
        const gameContainer = page.locator('main');
        await expect(gameContainer).toBeVisible();
    });
});
