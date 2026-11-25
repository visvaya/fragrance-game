import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing-config";

export { routing } from "./routing-config";

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
