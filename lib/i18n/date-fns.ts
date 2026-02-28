import { enUS, pl, type Locale  } from "date-fns/locale";

/**
 * Map of application locale codes to date-fns Locale objects.
 * When adding a new language to the app, add its date-fns locale here.
 */
const dateLocales: Record<string, Locale> = {
  en: enUS,
  pl: pl,
};

/**
 * Returns the date-fns Locale object for a given locale code.
 * Fallbacks to enUS if the locale is not supported.
 * @param localeCode - The application locale code (e.g., 'en', 'pl')
 * @returns The date-fns Locale object
 */
export function getDateLocale(localeCode: string): Locale {
  return dateLocales[localeCode] ?? enUS;
}
