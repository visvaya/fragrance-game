import { describe, expect, it } from "vitest";

import { parseUserAgent } from "@/lib/auth/user-agent";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const EDGE_WIN = `${CHROME_WIN} Edg/130.0.2849.56`;
const OPERA_WIN = `${CHROME_WIN} OPR/115.0.0.0`;
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.37 Mobile/15E148 Safari/604.1";
const FIREFOX_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const CHROME_ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAMSUNG =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36";
const CHROME_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

describe("parseUserAgent", () => {
  it.each([
    ["Chrome on Windows", CHROME_WIN, "Chrome", "Windows", "desktop"],
    ["Edge on Windows", EDGE_WIN, "Edge", "Windows", "desktop"],
    ["Opera on Windows", OPERA_WIN, "Opera", "Windows", "desktop"],
    ["Firefox on Linux", FIREFOX_LINUX, "Firefox", "Linux", "desktop"],
    ["Chrome on Linux", CHROME_LINUX, "Chrome", "Linux", "desktop"],
    ["Chrome on macOS", CHROME_MAC, "Chrome", "macOS", "desktop"],
    ["Safari on macOS", SAFARI_MAC, "Safari", "macOS", "desktop"],
    ["Safari on iPhone", SAFARI_IPHONE, "Mobile Safari", "iOS", "mobile"],
    ["Safari on iPad", SAFARI_IPAD, "Mobile Safari", "iOS", "tablet"],
    ["Chrome on iOS", CHROME_IOS, "Chrome", "iOS", "mobile"],
    ["Firefox on iOS", FIREFOX_IOS, "Firefox", "iOS", "mobile"],
    ["Chrome on Android", CHROME_ANDROID, "Chrome", "Android", "mobile"],
    [
      "Chrome on Android tablet",
      CHROME_ANDROID_TABLET,
      "Chrome",
      "Android",
      "tablet",
    ],
    ["Samsung Internet", SAMSUNG, "Samsung Internet", "Android", "mobile"],
  ])("%s", (_label, userAgent, browser, os, deviceType) => {
    expect(parseUserAgent(userAgent)).toEqual({ browser, deviceType, os });
  });

  it("falls back to null names and desktop for unknown strings", () => {
    expect(parseUserAgent("curl/8.4.0")).toEqual({
      browser: null,
      deviceType: "desktop",
      os: null,
    });
    expect(parseUserAgent("")).toEqual({
      browser: null,
      deviceType: "desktop",
      os: null,
    });
  });
});
