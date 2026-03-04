import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Messages = typeof import("../messages/pl.json");

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  // Ensure that the incoming `locale` is valid
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }

  const messagesModule = (await import(`../messages/${locale}.json`)) as {
    default: Messages;
  };

  return {
    locale,
    messages: messagesModule.default,
  };
});
