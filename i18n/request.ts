import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

import type messagesSchema from "../messages/pl.json";

type Messages = typeof messagesSchema;

// DEBT: requestLocale is deprecated in next-intl 4.9+; migrate to next/root-params
// (https://next-intl.dev/blog/nextjs-root-params). Tracked in docs/known-debt.md.
// eslint-disable-next-line sonarjs/deprecation, @typescript-eslint/no-deprecated -- see DEBT above
export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  // Ensure that the incoming `locale` is valid
  const locale =
    requestedLocale &&
    (routing.locales as readonly string[]).includes(requestedLocale)
      ? requestedLocale
      : routing.defaultLocale;

  const messagesModule = (await import(`../messages/${locale}.json`)) as {
    default: Messages;
  };

  return {
    locale,
    messages: messagesModule.default,
  };
});
