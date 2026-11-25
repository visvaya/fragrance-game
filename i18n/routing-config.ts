import { defineRouting } from "next-intl/routing";

// Kept apart from routing.ts for the proxy: on the server, createNavigation there loads the
// request config (i18n/request.ts, which reads next/root-params), and the proxy cannot bundle
// next/root-params.
export const routing = defineRouting({
  // hreflang comes from the page metadata and the sitemap; the middleware's Link header pointed
  // x-default at "/" and was also sent with 404 responses.
  alternateLinks: false,
  defaultLocale: "en",
  locales: ["en", "pl"],
});
