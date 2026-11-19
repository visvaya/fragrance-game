import { test, expect, type Page } from "@playwright/test";

// Budgets for the production build in CI; the dev server is too slow to meet them.
const BUDGET = {
  clsScore: 0.25,
  fcpMs: 1800,
  lcpMs: 2500,
  ttfbMs: 800,
} as const;
const LCP_WAIT_MS = 5000;
const CLS_WAIT_MS = 2000;

type Vitals = {
  cls: number;
  fcp: number | null;
  lcp: number | null;
  ttfb: number | null;
};

/** Reads TTFB, FCP, LCP and CLS of the current page from the browser performance APIs. */
async function readVitals(page: Page): Promise<Vitals> {
  return page.evaluate(
    async ({ clsWaitMs, lcpWaitMs }) => {
      const [navigation] = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      const ttfb = navigation
        ? navigation.responseStart - navigation.requestStart
        : null;
      const fcp =
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime ??
        null;
      const lcp = await new Promise<number | null>((resolve) => {
        new PerformanceObserver((list) => {
          resolve(list.getEntries().at(-1)?.startTime ?? null);
        }).observe({ buffered: true, type: "largest-contentful-paint" });
        setTimeout(() => resolve(null), lcpWaitMs);
      });
      const cls = await new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as { hadRecentInput?: boolean; value?: number };
            if (!shift.hadRecentInput) total += shift.value ?? 0;
          }
        }).observe({ buffered: true, type: "layout-shift" });
        setTimeout(() => resolve(total), clsWaitMs);
      });
      return { cls, fcp, lcp, ttfb };
    },
    { clsWaitMs: CLS_WAIT_MS, lcpWaitMs: LCP_WAIT_MS },
  );
}

test.describe("Web Vitals & Performance Audit", () => {
  const pagesToAudit = [
    { name: "Home", url: "/pl" },
    { name: "Login", url: "/pl/auth/login" },
  ];

  for (const { name, url } of pagesToAudit) {
    test(`Audit ${name} (${url})`, async ({ page }) => {
      test.skip(
        !process.env.CI,
        "Budgets apply to the production build in CI.",
      );

      await page.goto(url);
      // Login page renders a div (no <main>), home page has <main>
      await expect(
        page.locator("main, form, [role='main']").first(),
      ).toBeVisible();

      const vitals = await readVitals(page);
      console.log(`[web-vitals] ${name} ${url}: ${JSON.stringify(vitals)}`);

      expect(vitals.ttfb).not.toBeNull();
      expect(vitals.ttfb).toBeLessThan(BUDGET.ttfbMs);
      expect(vitals.fcp).not.toBeNull();
      expect(vitals.fcp).toBeLessThan(BUDGET.fcpMs);
      expect(vitals.lcp).not.toBeNull();
      expect(vitals.lcp).toBeLessThan(BUDGET.lcpMs);
      expect(vitals.cls).toBeLessThan(BUDGET.clsScore);
    });
  }
});
