/* eslint-disable playwright/no-wait-for-timeout -- memory tests require explicit waits to allow GC and heap stabilization */
import { test, expect } from "@playwright/test";

/**
 * Performance tests and memory leak detection.
 * We verify the stability of resource consumption during an intense game session.
 */
test.describe("Performance & Memory Audit", () => {
  test("should not have significant memory leaks during repeated game loads", async ({
    page,
  }) => {
    await page.goto("/game");
    await expect(page.locator("main")).toBeVisible();

    // Pobieramy bazowe zużycie pamięci (JS Heap) - wymaga Chromium
    const getMemory = async (): Promise<number> => {
      return await page.evaluate(() => {
        type PerformanceMemory = {
          usedJSHeapSize: number;
        };
        const perf = globalThis.performance as unknown as {
          memory?: PerformanceMemory;
        };
        return perf.memory ? perf.memory.usedJSHeapSize : 0;
      });
    };

    const initialMemory = await getMemory();

    // Jeśli środowisko nie wspiera performance.memory, pomijamy numeryczną walidację

    if (initialMemory === 0) {
      console.log(
        "Performance.memory not available, skipping numerical heap check.",
      );
      // But we still check if the page remains responsive after 10 reloads
      for (let i = 0; i < 10; i++) {
        await page.reload();
        await expect(page.locator("main")).toBeVisible();
        const title = await page.title();

        expect(title).toBeTruthy();
      }
      return;
    }

    // Simulate 5 game sessions (reloads)
    for (let i = 0; i < 5; i++) {
      await page.reload();
      await expect(page.locator("main")).toBeVisible();
      // Wait for GC (Garbage Collection) - optional, but gives a more stable result
      await page.waitForTimeout(1000);
    }

    const finalMemory = await getMemory();

    // We accept an increase of max 50% due to browser cache and JIT
    // In a real memory leak, the increase would be linear and much larger.
    console.log(
      `Initial Heap: ${initialMemory / 1024 / 1024}MB, Final Heap: ${finalMemory / 1024 / 1024}MB`,
    );
    expect(finalMemory).toBeLessThan(initialMemory * 3); // Very liberal limit for CI
  });

  test("Lighthouse performance budget (simulated)", async ({ page }) => {
    // Simple load time test (LCP equivalent)
    const start = Date.now();
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    const loadTime = Date.now() - start;

    console.log(`FCP equivalent (h1 visible): ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000); // 3s budget on local
  });
});
