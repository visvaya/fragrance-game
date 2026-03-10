import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Messages = typeof import("../messages/pl.json");

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
