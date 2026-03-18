import { test, expect, type Page } from "@playwright/test";

/** Waits for the `eauxle:session_ready` performance mark set inside GameProvider.initGame. */
async function waitForSessionReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      performance.getEntriesByName("eauxle:session_ready", "mark").length > 0,
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
  const totalMs =
    initStart != null && sessionReady != null
      ? sessionReady.time - initStart.time
      : null;

  console.log(`\n=== ${label} ===`);
  for (const m of measures) {
    console.log(`  ${m.name}: ${m.duration.toFixed(0)}ms`);
  }
  if (totalMs !== null) {
    console.log(`  TOTAL (init_start → session_ready): ${totalMs.toFixed(0)}ms`);
  }
}

test.describe("Auth Waterfall Diagnostics", () => {
  test("new user — auth waterfall timing breakdown", async ({ browser }) => {
    // Fresh context = no cookies = new user path (anon sign-in + verify)
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto("/en");
      await waitForSessionReady(page);

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
    await waitForSessionReady(page);

    // Reload simulates returning user — session already in cookies, auth skipped
    await page.reload();
    await waitForSessionReady(page);

    const { marks, measures } = await collectMarksAndMeasures(page);
    printBreakdown("Returning User Waterfall", measures, marks);

    // Returning user must NOT trigger anonymous auth
    const anonAuth = measures.find((m) => m.name === "eauxle.anon_auth");
    expect(anonAuth).toBeUndefined();

    // game_fetch should be fast: SSR challenge + 1 DB roundtrip only
    const gameF = measures.find((m) => m.name === "eauxle.game_fetch");
    if (gameF != null) expect(gameF.duration).toBeLessThan(500);
  });
});
