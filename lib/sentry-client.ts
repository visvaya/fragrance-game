import * as Sentry from "@sentry/nextjs";

import { publicEnv } from "@/lib/public-env";
import { scrubEvent } from "@/lib/sentry-scrub";

// eslint-disable-next-line no-restricted-properties -- NODE_ENV is needed for build-time dead-code elimination; env.NODE_ENV indirection prevents tree-shaking
const SENTRY_ENABLED = process.env.NODE_ENV !== "development";

/**
 * Starts the browser Sentry SDK once. Callers load this module on demand, so the SDK stays out
 * of the start-up bundle.
 */
export function startSentryClient(): void {
  if (Sentry.getClient()) return;
  Sentry.init({
    beforeSend: scrubEvent,
    debug: false,
    dsn: publicEnv.NEXT_PUBLIC_SENTRY_DSN,
    enabled: SENTRY_ENABLED,
    integrations: [],
    tracesSampleRate: 0,
  });
}

/**
 * Reports an error caught by an error boundary, starting the SDK first if it has not started yet.
 * @param error - The caught error.
 */
export function reportClientError(error: unknown): void {
  startSentryClient();
  Sentry.captureException(error);
}
