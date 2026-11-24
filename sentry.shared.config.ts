import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-data-collection";
import { scrubEvent } from "@/lib/sentry-scrub";

import type { init } from "@sentry/nextjs";

/** Sentry options of the Node.js and edge runtimes, which differ in nothing. */
export const SENTRY_SERVER_OPTIONS = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Disable in local development – dev errors pollute the project with noise
  // and hide real production issues. Vercel preview/production still captured.
  enabled: process.env.NODE_ENV !== "development",

  tracesSampleRate: 0.1,
  debug: false,

  beforeSend: scrubEvent,
  dataCollection: SENTRY_DATA_COLLECTION,
} satisfies NonNullable<Parameters<typeof init>[0]>;
