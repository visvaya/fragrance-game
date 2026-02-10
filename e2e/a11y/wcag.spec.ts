import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automatyczne testy dostępności (WCAG 2.1) dla kluczowych stron.
 * Wykorzystujemy @axe-core/playwright do audytu renderowanego DOMu.
 */
test.describe('Accessibility Audits (Axe)', () => {
    test('homepage should have no serious accessibility violations', async ({ page }) => {
        await page.goto('/');

        // Czekamy na stabilizację strony (Fonts, Animations)
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

        expect(results.violations).toEqual([]);
    });

    test('game page should have no serious accessibility violations', async ({ page }) => {
        await page.goto('/game');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

        expect(results.violations).toEqual([]);
    });

    test('login modal should be accessible', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Kliknij przycisk logowania (jeśli istnieje)
        const loginBtn = page.getByRole('button', { name: /Zaloguj|Login/i });
        if (await loginBtn.isVisible()) {
            await loginBtn.click();
            // Poczekaj na animację modala
            await page.waitForTimeout(500);

            const results = await new AxeBuilder({ page })
                .include('[role="dialog"]') // Skup się na modalu
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();

            expect(results.violations).toEqual([]);
        }
    });
});
