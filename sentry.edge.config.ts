import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],

  // Disable in local development
  enabled: process.env.NODE_ENV !== "development",

  tracesSampleRate: 0.1,
  debug: false,

  beforeSend: scrubEvent,
});
