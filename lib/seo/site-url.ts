import { env } from "@/lib/env";

/** Origin used when neither SITE_URL nor the platform hostname is set (local development). */
const LOCAL_SITE_URL = "http://localhost:3000";

/** Inputs that can name the public site address, in priority order. */
export type SiteUrlSources = {
  /** Production hostname without a scheme, as provided by the hosting platform. */
  readonly platformProductionHost?: string;
  /** Explicit absolute origin, e.g. `https://example.com`. */
  readonly siteUrl?: string;
};

/**
 * Picks the public site origin: the explicit `siteUrl` first, then the
 * platform's production hostname over HTTPS, then localhost. Empty strings
 * count as missing, because an unset variable often arrives as `""`.
 */
export function resolveSiteUrl({
  platformProductionHost,
  siteUrl,
}: SiteUrlSources): URL {
  if (siteUrl) {
    return new URL(siteUrl);
  }
  if (platformProductionHost) {
    return new URL(`https://${platformProductionHost}`);
  }
  return new URL(LOCAL_SITE_URL);
}

/** Public site origin for canonical links, hreflang, the sitemap and link previews. */
export function getSiteUrl(): URL {
  return resolveSiteUrl({
    platformProductionHost: env.VERCEL_PROJECT_PRODUCTION_URL,
    siteUrl: env.SITE_URL,
  });
}
