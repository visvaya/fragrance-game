import * as Sentry from "@sentry/nextjs";

import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-data-collection";
import { scrubEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Disable in local development – dev errors pollute the project with noise
  // and hide real production issues. Vercel preview/production still captured.
  enabled: process.env.NODE_ENV !== "development",

  tracesSampleRate: 0.1,
  debug: false,

  beforeSend: scrubEvent,
  dataCollection: SENTRY_DATA_COLLECTION,
});
