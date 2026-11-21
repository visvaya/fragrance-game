/** Coarse device class used to pick the icon of a session. */
type DeviceType = "desktop" | "mobile" | "tablet";

/** What the "Active sessions" list shows about a user agent; names are null when unrecognised. */
type ParsedUserAgent = {
  browser: string | null;
  deviceType: DeviceType;
  os: string | null;
};

// Order matters: the first match wins. Edge, Opera and Samsung Internet also contain "Chrome",
// Chrome and Firefox on iOS contain "Safari", and Chrome contains "Safari".
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/iP(?:hone|ad|od).*Safari\//, "Mobile Safari"],
  [/Safari\//, "Safari"],
];

// iPhone and iPad user agents also contain "like Mac OS X" and Android ones contain "Linux".
const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iP(?:hone|ad|od)/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "macOS"],
  [/Linux|X11/, "Linux"],
];

const nameFrom = (
  table: readonly (readonly [RegExp, string])[],
  userAgent: string,
): string | null =>
  table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

const deviceTypeOf = (userAgent: string): DeviceType => {
  if (/iPad|Tablet/.test(userAgent)) return "tablet";
  if (userAgent.includes("Android")) {
    return userAgent.includes("Mobile") ? "mobile" : "tablet";
  }
  return /iPhone|iPod|Mobile/.test(userAgent) ? "mobile" : "desktop";
};

/**
 * Classifies a user-agent string into browser name, operating system name and device type.
 * Covers the browsers and systems players use; anything else yields null names.
 * @param userAgent - The raw `User-Agent` header value.
 * @returns The browser and OS names (null when unknown) and the device type.
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  return {
    browser: nameFrom(BROWSERS, userAgent),
    deviceType: deviceTypeOf(userAgent),
    os: nameFrom(SYSTEMS, userAgent),
  };
}
