// Regenerates the README screenshot: the public start screen as a first-time visitor sees it.
// Read-only (one page load, no guesses, no login), so it is safe against production.
// Usage: pnpm screenshot:readme [url]   (default: https://eauxle.vercel.app/en)
// Fonts render differently per OS: refresh the image from CI (Linux) or a Linux sandbox, not from
// Windows, so that a regeneration only changes the image when the interface changed.
import path from "node:path";

import { chromium } from "@playwright/test";

import { isMainModule } from "./is-main";

const DEFAULT_URL = "https://eauxle.vercel.app/en";
const OUTPUT_PATH = path.join("docs", "screenshot.png");
const VIEWPORT = { height: 800, width: 1280 } as const;
const SETTLE_TIMEOUT_MS = 30_000;
const SETTLE_DELAY_MS = 2000;

/** Loads the page in a fixed window and light scheme, then writes the PNG to `outputPath`. */
async function captureStartScreen(url: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      colorScheme: "light",
      deviceScaleFactor: 1,
      locale: "en-US",
      reducedMotion: "reduce",
      viewport: VIEWPORT,
    });
    const page = await context.newPage();
    await page.goto(url, { timeout: SETTLE_TIMEOUT_MS, waitUntil: "load" });
    // Analytics keep the network busy, so "networkidle" never settles; wait for the content and fonts instead.
    await page.locator("main").waitFor({ timeout: SETTLE_TIMEOUT_MS });
    await page.evaluate(async () => document.fonts.ready);
    await page.waitForTimeout(SETTLE_DELAY_MS);
    await page.screenshot({ path: outputPath });
  } finally {
    await browser.close();
  }
}

async function main(url: string): Promise<void> {
  await captureStartScreen(url, OUTPUT_PATH);
  console.log(`Wrote ${OUTPUT_PATH} from ${url}`);
}

if (isMainModule(import.meta.url, process.argv[1])) {
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- tsx compiles this script as CJS, where top-level await is unsupported
  main(process.argv[2] ?? DEFAULT_URL).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
