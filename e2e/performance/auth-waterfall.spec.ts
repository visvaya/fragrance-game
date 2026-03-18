import { test, expect, type Page } from "@playwright/test";

/**
 * Waits for GameProvider.initGame to finish — either successfully (session_ready)
 * or via an early exit (captcha / auth error → init_end without session_ready).
 */
async function waitForInitEnd(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      performance.getEntriesByName("eauxle:init_end", "mark").length > 0,
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

function printBreakdown(label: string, measures: PerfMeasure[], marks: PerfMark[]): void {
  const initStart = marks.find((m) => m.name === "eauxle:init_start");
  const sessionReady = marks.find((m) => m.name === "eauxle:session_ready");
  const initEnd = marks.find((m) => m.name === "eauxle:init_end");
  const endMark = sessionReady ?? initEnd;
  const totalMs =
    initStart != null && endMark != null
      ? endMark.time - initStart.time
      : null;

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
  test("new user — auth waterfall timing breakdown", async ({ browser }) => {
    // Fresh context = no cookies = new user path (anon sign-in + verify)
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto("/en");
      await waitForInitEnd(page);

      const { marks, measures } = await collectMarksAndMeasures(page);
      printBreakdown("New User Auth Waterfall", measures, marks);

      const anonAuth = measures.find((m) => m.name === "eauxle.anon_auth");
      const gameF = measures.find((m) => m.name === "eauxle.game_fetch");

      if (anonAuth) expect(anonAuth.duration).toBeLessThan(3000);
      if (gameF) expect(gameF.duration).toBeLessThan(1000);
    } finally {
      await context.close();
    }
  });

  test("returning user — no auth roundtrip, game_fetch only", async ({ page }) => {
    // First visit to establish anonymous session in cookies
    await page.goto("/en");
    await waitForInitEnd(page);

    // Check if first load succeeded (session in cookies)
    const firstLoadMarks = await page.evaluate((): PerfMark[] =>
      performance
        .getEntriesByType("mark")
        .filter((e) => e.name.startsWith("eauxle:"))
        .map((e) => ({ name: e.name, time: e.startTime })),
    );
    const firstLoadSucceeded = firstLoadMarks.some(
      (m) => m.name === "eauxle:session_ready",
    );

    // Reload simulates returning user — session already in cookies, auth skipped
    await page.reload();
    await waitForInitEnd(page);

    const { marks, measures } = await collectMarksAndMeasures(page);
    printBreakdown("Returning User Waterfall (after reload)", measures, marks);

    if (firstLoadSucceeded) {
      // Returning user with session in cookies must NOT trigger anon auth
      const anonAuth = measures.find((m) => m.name === "eauxle.anon_auth");
      expect(anonAuth).toBeUndefined();

      // game_fetch should be fast: SSR challenge + 1 DB roundtrip only
      const gameF = measures.find((m) => m.name === "eauxle.game_fetch");
      if (gameF != null) expect(gameF.duration).toBeLessThan(500);
    } else {
      console.log(
        "  NOTE: first load did not establish session (captcha?) — returning-user assertions skipped",
      );
    }
  });
});
