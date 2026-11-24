import { describe, expect, it, vi } from "vitest";

import { generateMetadata as localeMetadata } from "@/app/[locale]/layout";
import { metadata as authMetadata } from "@/app/[locale]/auth/layout";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { routing } from "@/i18n/routing";

import type { MetadataRoute } from "next";

/**
 * Publishing contract of the site: every sitemap URL is crawlable and
 * indexable, carries a canonical link equal to its sitemap entry plus the
 * hreflang set, and the auth pages stay out of search results. Run alone with
 * `pnpm check:seo`.
 */

vi.mock("@/lib/env", () => ({
  env: {
    SITE_URL: "https://eauxle.example",
    VERCEL_PROJECT_PRODUCTION_URL: "",
  },
}));

// The locale layout only needs its metadata here: stub fonts, request APIs and UI.
vi.mock("next/font/google", () => ({
  Caveat: () => ({ variable: "" }),
  Geist: () => ({ variable: "" }),
  Geist_Mono: () => ({ variable: "" }),
  Playfair_Display: () => ({ variable: "" }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: vi.fn() }));
vi.mock("next-intl", () => ({ NextIntlClientProvider: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getMessages: vi.fn(),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock("@/components/auth/auth-error-watcher", () => ({
  AuthErrorWatcher: vi.fn(),
}));
vi.mock("@/components/game/contexts/ui-preferences-context", () => ({
  UIPreferencesProvider: vi.fn(),
}));
vi.mock("@/components/providers/analytics-providers", () => ({
  AnalyticsProviders: vi.fn(),
}));
vi.mock("@/components/providers/lazy-toaster", () => ({
  LazyToaster: vi.fn(),
}));
vi.mock("@/components/providers/smooth-scroll-provider", () => ({
  SmoothScrollProvider: vi.fn(),
}));
vi.mock("@/components/ui/tooltip", () => ({ TooltipProvider: vi.fn() }));

/** Absolute form of a metadata link; the locale layout only emits relative strings. */
function resolve(link: unknown, base: URL): string {
  return new URL(typeof link === "string" ? link : "", base).href;
}

const SITE_ORIGIN = "https://eauxle.example";
const NON_INDEXABLE_PREFIXES = ["/api/", "/ph-proxy/", "/auth/"];

type RobotsRule = Exclude<MetadataRoute.Robots["rules"], unknown[]>;

/** Robots.txt matching for `*`: the longest matching rule wins, allow wins ties. */
function isCrawlable(path: string, rule: RobotsRule): boolean {
  const patterns = (value: string | string[] | undefined): string[] =>
    [value ?? []].flat();
  const longest = (list: string[]): number =>
    Math.max(
      -1,
      ...list.filter((p) => path.startsWith(p)).map((p) => p.length),
    );

  return longest(patterns(rule.allow)) >= longest(patterns(rule.disallow));
}

describe("robots.txt", () => {
  const result = robots();
  const rule = result.rules as RobotsRule;

  it("addresses every crawler with a single rule set", () => {
    expect(Array.isArray(result.rules)).toBe(false);
    expect(rule.userAgent).toBe("*");
  });

  it("lets crawlers fetch every sitemap URL and keeps them out of API routes", () => {
    for (const { url } of sitemap()) {
      expect(isCrawlable(new URL(url).pathname, rule)).toBe(true);
    }
    expect(isCrawlable("/api/db", rule)).toBe(false);
    expect(isCrawlable("/ph-proxy/e", rule)).toBe(false);
  });

  it("points at the absolute sitemap on the public origin", () => {
    expect(result.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("lists one absolute URL per locale on the public origin", () => {
    expect(
      entries.map((entry) => new URL(entry.url).pathname).toSorted(),
    ).toEqual(routing.locales.map((locale) => `/${locale}`).toSorted());
    for (const { url } of entries) {
      expect(new URL(url).origin).toBe(SITE_ORIGIN);
    }
  });

  it("holds no auth, API or proxy URLs", () => {
    for (const { url } of entries) {
      const { pathname } = new URL(url);
      expect(
        NON_INDEXABLE_PREFIXES.some((prefix) =>
          `${pathname}/`.includes(prefix),
        ),
      ).toBe(false);
    }
  });

  it("links every locale and x-default from every entry, itself included", () => {
    const expectedCodes = [...routing.locales, "x-default"].toSorted();

    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).toSorted()).toEqual(expectedCodes);
      expect(Object.values(languages)).toContain(entry.url);
    }
  });
});

describe("page metadata", () => {
  it.each(routing.locales)(
    "indexes the %s home page with a canonical equal to its sitemap entry",
    async (locale) => {
      const metadata = await localeMetadata({
        params: Promise.resolve({ locale }),
      });
      const entry = sitemap().find(
        ({ url }) => new URL(url).pathname === `/${locale}`,
      );
      const base = metadata.metadataBase as URL;

      expect(metadata.robots).toBeUndefined();
      expect(resolve(metadata.alternates?.canonical, base)).toBe(entry?.url);
      expect(
        Object.entries(metadata.alternates?.languages ?? {}).map(
          ([code, href]) => [code, resolve(href, base)],
        ),
      ).toEqual(Object.entries(entry?.alternates?.languages ?? {}));
    },
  );

  it("keeps auth pages out of search results without a canonical link", () => {
    expect(authMetadata.robots).toMatchObject({ index: false });
    expect(authMetadata.alternates).toBeNull();
  });
});
