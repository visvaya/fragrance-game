import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
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

export const { usePathname, useRouter } = createNavigation(routing);
