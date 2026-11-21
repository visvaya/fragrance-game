import { parse } from "bowser";

/** Coarse device class used to pick the icon of a session. */
type DeviceType = "desktop" | "mobile" | "tablet";

/** What the "Active sessions" list shows about a user agent; names are null when unrecognised. */
type ParsedUserAgent = {
  browser: string | null;
  deviceType: DeviceType;
  os: string | null;
};

/**
 * Classifies a user-agent string into browser name, operating system name and device type
 * with Bowser (MIT, maintained), which tracks new user-agent formats for us.
 * @param userAgent - The raw `User-Agent` header value.
 * @returns The browser and OS names (null when unknown) and the device type.
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  // Bowser throws on an empty string.
  if (userAgent.trim() === "") {
    return { browser: null, deviceType: "desktop", os: null };
  }
  const { browser, os, platform } = parse(userAgent);
  return {
    browser: browser.name || null,
    deviceType:
      platform.type === "mobile" || platform.type === "tablet"
        ? platform.type
        : "desktop",
    os: os.name || null,
  };
}
