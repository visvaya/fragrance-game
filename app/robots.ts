import { getSiteUrl } from "@/lib/seo/site-url";

import type { MetadataRoute } from "next";

/**
 * robots.txt: crawl the game and keep crawlers out of API routes, the
 * analytics proxy and the Sentry test page. Auth pages stay crawlable so
 * crawlers can read their `noindex` tag.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      allow: "/",
      disallow: ["/api/", "/ph-proxy/", "/sentry-example-page"],
      userAgent: "*",
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
