import { env } from "@/lib/env";

/** Origin used outside production when neither SITE_URL nor the platform hostname is set. */
const LOCAL_SITE_URL = "http://localhost:3000";

/** Inputs that can name the public site address, in priority order. */
export type SiteUrlSources = {
  /** Whether this is a production build or server, where a localhost fallback would leak into published links. */
  readonly isProduction: boolean;
  /** Production hostname without a scheme, as provided by the hosting platform. */
  readonly platformProductionHost?: string;
  /** Explicit absolute origin, e.g. `https://example.com`. */
  readonly siteUrl?: string;
};

/**
 * Picks the public site origin: the explicit `siteUrl` first, then the
 * platform's production hostname over HTTPS, then localhost outside
 * production. Empty strings count as missing, because an unset variable often
 * arrives as `""`.
 * @throws {Error} In production when no public origin is configured, so
 * canonical links and the sitemap never point at localhost.
 */
export function resolveSiteUrl({
  isProduction,
  platformProductionHost,
  siteUrl,
}: SiteUrlSources): URL {
  if (siteUrl) {
    return new URL(siteUrl);
  }
  if (platformProductionHost) {
    return new URL(`https://${platformProductionHost}`);
  }
  if (isProduction) {
    throw new Error(
      "SITE_URL is not set: production needs the public origin (e.g. https://example.com) for canonical links and the sitemap.",
    );
  }
  return new URL(LOCAL_SITE_URL);
}

/** Public site origin for canonical links, hreflang, the sitemap and link previews. */
export function getSiteUrl(): URL {
  return resolveSiteUrl({
    isProduction: env.NODE_ENV === "production",
    platformProductionHost: env.VERCEL_PROJECT_PRODUCTION_URL,
    siteUrl: env.SITE_URL,
  });
}
