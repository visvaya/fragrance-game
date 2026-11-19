/* eslint-disable playwright/no-wait-for-timeout -- memory tests require explicit waits to allow GC and heap stabilization */
import { test, expect, type Page } from "@playwright/test";

const RELOAD_COUNT = 5;
// A real leak grows the heap with every reload; cache and JIT warm-up stay well below this.
const MAX_HEAP_GROWTH_FACTOR = 3;
const LOAD_BUDGET_MS = 3000;

/** Reads the used JS heap size; `performance.memory` exists only in Chromium. */
async function readUsedHeapBytes(page: Page): Promise<number | undefined> {
  return page.evaluate(
    () =>
      (globalThis.performance as { memory?: { usedJSHeapSize: number } }).memory
        ?.usedJSHeapSize,
  );
}

/**
 * Performance tests and memory leak detection.
 * We verify the stability of resource consumption during an intense game session.
 */
test.describe("Performance & Memory Audit", () => {
  test("should not have significant memory leaks during repeated game loads", async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== "chromium",
      "performance.memory is Chromium-only.",
    );

    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();
    const initialHeap = await readUsedHeapBytes(page);
    expect(initialHeap).toBeGreaterThan(0);

    for (let i = 0; i < RELOAD_COUNT; i++) {
      await page.reload();
      await expect(page.locator("main")).toBeVisible();
      // Give the garbage collector time to settle between loads.
      await page.waitForTimeout(1000);
    }

    const finalHeap = await readUsedHeapBytes(page);
    console.log(`[memory] heap bytes: ${initialHeap} -> ${finalHeap}`);
    expect(finalHeap).toBeLessThan(
      Number(initialHeap) * MAX_HEAP_GROWTH_FACTOR,
    );
  });

  test("home page shows its heading within the load budget", async ({
    page,
  }) => {
    test.skip(
      !process.env.CI,
      "The budget applies to the production build in CI.",
    );

    const start = Date.now();
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    const loadTime = Date.now() - start;

    console.log(`[memory] h1 visible after ${loadTime}ms`);
    expect(loadTime).toBeLessThan(LOAD_BUDGET_MS);
  });
});
