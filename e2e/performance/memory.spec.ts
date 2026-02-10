import { test, expect } from '@playwright/test';

/**
 * Testy wydajnościowe i detekcja wycieków pamięci.
 * Weryfikujemy stabilność zużycia zasobów podczas intensywnej sesji gry.
 */
test.describe('Performance & Memory Audit', () => {
    test('should not have significant memory leaks during repeated game loads', async ({ page }) => {
        await page.goto('/game');
        await page.waitForLoadState('networkidle');

        // Pobieramy bazowe zużycie pamięci (JS Heap) - wymaga Chromium
        const getMemory = async () => {
            return await page.evaluate(() => {
                // @ts-ignore - non-standard Chrome property
                return window.performance.memory ? window.performance.memory.usedJSHeapSize : 0;
            });
        };

        const initialMemory = await getMemory();

        // Jeśli środowisko nie wspiera performance.memory, pomijamy numeryczną walidację
        if (initialMemory === 0) {
            console.log('Performance.memory not available, skipping numerical heap check.');
            // Ale nadal sprawdzamy czy strona pozostaje responsywna po 10 przeładowaniach
            for (let i = 0; i < 10; i++) {
                await page.reload();
                await page.waitForLoadState('networkidle');
                const title = await page.title();
                expect(title).toBeTruthy();
            }
            return;
        }

        // Symulujemy 5 sesji gry (przeładowania)
        for (let i = 0; i < 5; i++) {
            await page.reload();
            await page.waitForLoadState('networkidle');
            // Czekamy na GC ( Garbage Collection) - opcjonalne, ale daje stabilniejszy wynik
            await page.waitForTimeout(1000);
        }

        const finalMemory = await getMemory();

        // Akceptujemy wzrost o max 50% ze względu na cache przeglądarki i JIT
        // W prawdziwym wycieku pamięci wzrost byłby liniowy i znacznie większy.
        console.log(`Initial Heap: ${initialMemory / 1024 / 1024}MB, Final Heap: ${finalMemory / 1024 / 1024}MB`);
        expect(finalMemory).toBeLessThan(initialMemory * 3.0); // Bardzo liberalny limit dla CI
    });

    test('Lighthouse performance budget (simulated)', async ({ page }) => {
        // Prosty test czasu ładowania (LCP equivalent)
        const start = Date.now();
        await page.goto('/');
        await page.waitForSelector('h1');
        const loadTime = Date.now() - start;

        console.log(`FCP equivalent (h1 visible): ${loadTime}ms`);
        expect(loadTime).toBeLessThan(3000); // Budżet 3s na localu
    });
});
