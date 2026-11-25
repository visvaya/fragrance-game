import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // hreflang comes from the page metadata and the sitemap; the middleware's Link header pointed
  // x-default at "/" and was also sent with 404 responses.
  alternateLinks: false,
  defaultLocale: "en",
  locales: ["en", "pl"],
});

/**
 * Display names for supported locales.
 * Centralized here to avoid duplication in translation files
 * since language names are usually endonyms (native names).
 */
export const localeNames: Record<string, string> = {
  en: "English",
  pl: "Polski",
};
