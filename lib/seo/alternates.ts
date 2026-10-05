import { routing } from "@/i18n/routing";

/** Open Graph locale tags (language_TERRITORY) for each supported locale. */
const OPEN_GRAPH_LOCALES: Readonly<Record<string, string>> = {
  en: "en_US",
  pl: "pl_PL",
};

/** Canonical link and hreflang map for one page, as relative paths. */
export type LocaleAlternates = {
  readonly canonical: string;
  readonly languages: Readonly<Record<string, string>>;
};

/**
 * Builds the locale-prefixed path of a page, e.g. `("pl", "/")` gives `/pl`
 * and `("pl", "/archive")` gives `/pl/archive`.
 */
export function localizedPath(locale: string, path = "/"): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * Canonical link for `locale` plus one hreflang entry per supported locale
 * and `x-default` pointing at the default locale. Paths are relative and are
 * resolved against `metadataBase`.
 */
export function buildAlternates(locale: string, path = "/"): LocaleAlternates {
  const entries: (readonly [string, string])[] = [
    ...routing.locales.map((code): readonly [string, string] => [
      code,
      localizedPath(code, path),
    ]),
    ["x-default", localizedPath(routing.defaultLocale, path)],
  ];
  const languages: Record<string, string> = Object.fromEntries(entries);

  return { canonical: localizedPath(locale, path), languages };
}

/** Open Graph locale tag for `locale`, falling back to the default locale's tag. */
export function openGraphLocale(locale: string): string {
  return (
    OPEN_GRAPH_LOCALES[locale] ?? OPEN_GRAPH_LOCALES[routing.defaultLocale]
  );
}

/** Open Graph locale tags of every supported locale except `locale`. */
export function alternateOpenGraphLocales(locale: string): readonly string[] {
  return routing.locales
    .filter((code) => code !== locale)
    .map((code) => openGraphLocale(code));
}
