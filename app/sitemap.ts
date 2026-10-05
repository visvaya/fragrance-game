import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { getSiteUrl } from "@/lib/seo/site-url";

import type { MetadataRoute } from "next";

/** Indexable pages, as locale-independent paths. Auth pages are `noindex`. */
const INDEXABLE_PATHS = ["/"] as const;

/** sitemap.xml: every indexable page in every locale, linked to its translations. */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const absolute = (path: string): string => new URL(path, siteUrl).toString();

  return INDEXABLE_PATHS.flatMap((path) =>
    routing.locales.map((locale) => {
      const { canonical, languages } = buildAlternates(locale, path);

      return {
        alternates: {
          languages: Object.fromEntries(
            Object.entries(languages).map(([code, href]) => [
              code,
              absolute(href),
            ]),
          ),
        },
        changeFrequency: "daily" as const,
        url: absolute(canonical),
      };
    }),
  );
}
