import { test, expect } from "@playwright/test";

test.describe("Web Vitals & Performance Audit", () => {
  const pagesToAudit = [
    { name: "Home", url: "/pl" },
    { name: "Login", url: "/pl/auth/login" },
  ];

  for (const { name, url } of pagesToAudit) {
    test(`Audit ${name} (${url})`, async ({ page }) => {
      // 1. Setup CDPSession for performance metrics
      const client = await page.context().newCDPSession(page);
      await client.send("Performance.enable");

      // 2. Navigation
      const navStart = Date.now();
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      const navEnd = Date.now();

      // 3. Navigation Timing API
      const navTiming = await page.evaluate(() => {
        const entries = performance.getEntriesByType("navigation");
        if (entries.length > 0) {
          const nav = entries[0] as PerformanceNavigationTiming;
          return {
            domComplete: nav.domComplete,
            domInteractive: nav.domInteractive,
            duration: nav.duration,
            loadEventEnd: nav.loadEventEnd,
            ttfb: nav.responseStart - nav.requestStart,
          };
        }
        return null;
      });

      // 4. Paint Timing API (FCP)
      const fcp = await page.evaluate(() => {
        const entries = performance.getEntriesByName("first-contentful-paint");
        return entries.length > 0 ? entries[0].startTime : null;
      });

      // 5. Largest Contentful Paint (LCP)
      const lcp = await page.evaluate(async () => {
        return new Promise((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries.at(-1);
            resolve(lastEntry?.startTime ?? null);
          }).observe({ buffered: true, type: "largest-contentful-paint" });

          // Fallback if no LCP observed quickly
          setTimeout(() => resolve(null), 5000);
        });
      });

      // 6. Cumulative Layout Shift (CLS)
      const cls = await page.evaluate(async () => {
        return new Promise((resolve) => {
          let clsValue = 0;
          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              const layoutShift = entry as {
                hadRecentInput?: boolean;
                value?: number;
              };
              if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value ?? 0;
              }
            }
            resolve(clsValue);
          }).observe({ buffered: true, type: "layout-shift" });

          // Resolve after a short delay to catch shifts
          setTimeout(() => resolve(clsValue), 2000);
        });
      });

      console.log(`\n--- Performance Report: ${name} ---`);
      console.log(`URL: ${url}`);
      console.log(`TTFB: ${(navTiming?.ttfb ?? 0).toFixed(2)} ms`);
      console.log(`FCP: ${(fcp ?? 0).toFixed(2)} ms`);
      console.log(`LCP: ${lcp ? Number(lcp).toFixed(2) : "N/A"} ms`);
      console.log(`CLS: ${Number(cls).toFixed(4)}`);
      console.log(`Total Duration (networkidle): ${navEnd - navStart} ms`);
      console.log(`-----------------------------------`);

      // Expectations (Budgets)
      // TTFB < 600ms (Good)
      expect(navTiming?.ttfb).toBeLessThan(800);

      // FCP < 1800ms (Good)

      if (fcp) {
        expect(fcp).toBeLessThan(3000); // 3s budget for local dev
      }

      // LCP < 2500ms (Good)

      if (lcp) {
        expect(Number(lcp)).toBeLessThan(4000); // 4s budget for local dev
      }

      // CLS < 0.1 (Good)
      expect(Number(cls)).toBeLessThan(0.25); // 0.25 budget
    });
  }
});
