import path from "node:path";

import { test, expect, type Page } from "@playwright/test";

// Playwright runs from the project root and loads specs as CommonJS (no import.meta).
const AUTH_FILE = path.join(process.cwd(), "e2e", ".auth", "user.json");
const ANON_AUTH_BUDGET_MS = 3000;

/**
 * Waits for GameProvider.initGame to finish – either successfully (session_ready)
 * or via an early exit (captcha / auth error → init_end without session_ready).
 */
async function waitForInitEnd(page: Page): Promise<void> {
  await page.waitForFunction(
    () => performance.getEntriesByName("eauxle:init_end", "mark").length > 0,
    { timeout: 25_000 },
  );
}

type PerfMeasure = { duration: number; name: string };
type PerfMark = { name: string; time: number };

async function collectMarksAndMeasures(page: Page): Promise<{
  marks: PerfMark[];
  measures: PerfMeasure[];
}> {
  const measures = await page.evaluate((): PerfMeasure[] =>
    performance
      .getEntriesByType("measure")
      .filter((e) => e.name.startsWith("eauxle."))
      .map((e) => ({ duration: e.duration, name: e.name })),
  );

  const marks = await page.evaluate((): PerfMark[] =>
    performance
      .getEntriesByType("mark")
      .filter((e) => e.name.startsWith("eauxle:"))
      .map((e) => ({ name: e.name, time: e.startTime })),
  );

  return { marks, measures };
}

function printBreakdown(
  label: string,
  measures: PerfMeasure[],
  marks: PerfMark[],
): void {
  const initStart = marks.find((m) => m.name === "eauxle:init_start");
  const sessionReady = marks.find((m) => m.name === "eauxle:session_ready");
  const initEnd = marks.find((m) => m.name === "eauxle:init_end");
  const endMark = sessionReady ?? initEnd;
  const totalMs =
    initStart != null && endMark != null ? endMark.time - initStart.time : null;

  const succeeded = sessionReady != null;
  const outcome = succeeded ? "SUCCESS" : "EARLY EXIT (captcha / auth error)";

  console.log(`\n=== ${label} [${outcome}] ===`);
  for (const m of measures) {
    console.log(`  ${m.name}: ${m.duration.toFixed(0)}ms`);
  }
  if (totalMs !== null) {
    const endLabel = succeeded ? "session_ready" : "init_end";
    console.log(`  TOTAL (init_start → ${endLabel}): ${totalMs.toFixed(0)}ms`);
  }
}

test.describe("Auth Waterfall Diagnostics", () => {
  test("new user – anonymous sign-in stays within budget", async ({
    browser,
  }) => {
    // Fresh context = no cookies = new user path. In CI the captcha stops the flow after the
    // anonymous sign-in (init ends without session_ready), so only that step is measured.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en");
    await waitForInitEnd(page);

    const { marks, measures } = await collectMarksAndMeasures(page);
    printBreakdown("New User Auth Waterfall", measures, marks);
    await context.close();

    const anonAuth = measures.find((m) => m.name === "eauxle.anon_auth");
    expect(anonAuth?.duration).toBeLessThan(ANON_AUTH_BUDGET_MS);
  });

  test.describe("returning user", () => {
    // Pre-authenticated session from globalSetup: the session is already in the cookies.
    test.use({ storageState: AUTH_FILE });

    test("no auth or client game fetch: the challenge comes from SSR", async ({
      page,
    }) => {
      await page.goto("/en");
      await waitForInitEnd(page);

      const { marks, measures } = await collectMarksAndMeasures(page);
      printBreakdown("Returning User Waterfall", measures, marks);

      expect(marks.map((m) => m.name)).toContain("eauxle:session_ready");
      const measureNames = measures.map((m) => m.name);
      expect(measureNames).not.toContain("eauxle.anon_auth");
      expect(measureNames).not.toContain("eauxle.game_fetch");
    });
  });
});
