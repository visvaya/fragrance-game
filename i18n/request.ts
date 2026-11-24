import * as rootParams from "next/root-params";

import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

import type messagesSchema from "../messages/pl.json";

type Messages = typeof messagesSchema;

export default getRequestConfig(async ({ locale: override }) => {
  // An explicit locale (getTranslations({ locale })) wins; otherwise the [locale] segment.
  // An unknown segment (e.g. /unknown.txt) falls back to the default locale, as the layout
  // renders the not-found page for it.
  const requested = override ?? (await rootParams.locale());
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messagesModule = (await import(`../messages/${locale}.json`)) as {
    default: Messages;
  };

  return {
    locale,
    messages: messagesModule.default,
  };
});
