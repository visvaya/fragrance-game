import { describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  alternateOpenGraphLocales,
  buildAlternates,
  localizedPath,
  openGraphLocale,
} from "@/lib/seo/alternates";
import { resolveSiteUrl } from "@/lib/seo/site-url";

vi.mock("@/i18n/routing", () => ({
  routing: { defaultLocale: "en", locales: ["en", "pl"] },
}));

vi.mock("@/lib/env", () => ({
  env: {
    SITE_URL: "https://eauxle.example",
    VERCEL_PROJECT_PRODUCTION_URL: "",
  },
}));

describe("resolveSiteUrl", () => {
  it("prefers the explicit site URL", () => {
    const url = resolveSiteUrl({
      isProduction: true,
      platformProductionHost: "app.vercel.app",
      siteUrl: "https://eauxle.example",
    });

    expect(url.origin).toBe("https://eauxle.example");
  });

  it("falls back to the platform host over HTTPS when the site URL is empty", () => {
    const url = resolveSiteUrl({
      isProduction: true,
      platformProductionHost: "app.vercel.app",
      siteUrl: "",
    });

    expect(url.origin).toBe("https://app.vercel.app");
  });

  it("falls back to localhost outside production when nothing is set", () => {
    expect(resolveSiteUrl({ isProduction: false }).origin).toBe(
      "http://localhost:3000",
    );
  });

  it("refuses to publish localhost links in production", () => {
    expect(() =>
      resolveSiteUrl({ isProduction: true, platformProductionHost: "" }),
    ).toThrow(/SITE_URL is not set/);
  });
});

describe("locale alternates", () => {
  it("prefixes paths with the locale and drops the trailing root slash", () => {
    expect(localizedPath("pl")).toBe("/pl");
    expect(localizedPath("en", "/archive")).toBe("/en/archive");
  });

  it("links every locale and points x-default at the default locale", () => {
    expect(buildAlternates("pl")).toEqual({
      canonical: "/pl",
      languages: { en: "/en", pl: "/pl", "x-default": "/en" },
    });
  });

  it("maps locales to Open Graph tags with a default fallback", () => {
    expect(openGraphLocale("pl")).toBe("pl_PL");
    expect(openGraphLocale("xx")).toBe("en_US");
    expect(alternateOpenGraphLocales("en")).toEqual(["pl_PL"]);
  });
});

describe("robots and sitemap", () => {
  it("keeps crawlers out of API routes and points at the sitemap", () => {
    const result = robots();

    expect(result.rules).toMatchObject({
      allow: "/",
      disallow: expect.arrayContaining(["/api/"]),
    });
    expect(result.sitemap).toBe("https://eauxle.example/sitemap.xml");
  });

  it("lists the home page in each locale with absolute hreflang links", () => {
    const entries = sitemap();

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://eauxle.example/en",
      "https://eauxle.example/pl",
    ]);
    expect(entries[1].alternates?.languages).toEqual({
      en: "https://eauxle.example/en",
      pl: "https://eauxle.example/pl",
      "x-default": "https://eauxle.example/en",
    });
  });
});
