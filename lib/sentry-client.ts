import * as Sentry from "@sentry/nextjs";

import { publicEnv } from "@/lib/public-env";
import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-data-collection";
import { scrubEvent } from "@/lib/sentry-scrub";

/**
 * Whether the browser SDK reports errors. Preview deployments sit behind the host's login, which
 * redirects the report tunnel to a sign-in page, so their reports never arrive and only leave a
 * CSP error in the console. Without a deployment environment (local start, own server) a
 * production build reports.
 * @param nodeEnv - NODE_ENV of the build.
 * @param deploymentEnv - The host's deployment environment, if it sets one.
 */
export function isClientSentryEnabled(
  nodeEnv: string | undefined,
  deploymentEnv: string | undefined,
): boolean {
  return nodeEnv !== "development" && deploymentEnv !== "preview";
}

const SENTRY_ENABLED = isClientSentryEnabled(
  // eslint-disable-next-line no-restricted-properties -- NODE_ENV is needed for build-time dead-code elimination; env.NODE_ENV indirection prevents tree-shaking
  process.env.NODE_ENV,
  publicEnv.NEXT_PUBLIC_VERCEL_ENV,
);

/**
 * Starts the browser Sentry SDK once. Callers load this module on demand, so the SDK stays out
 * of the start-up bundle.
 */
export function startSentryClient(): void {
  if (Sentry.getClient()) return;
  Sentry.init({
    beforeSend: scrubEvent,
    dataCollection: SENTRY_DATA_COLLECTION,
    debug: false,
    dsn: publicEnv.NEXT_PUBLIC_SENTRY_DSN,
    enabled: SENTRY_ENABLED,
    integrations: [],
    tracesSampleRate: 0,
  });
}

/**
 * Sets the player's id on error reports, starting the SDK first if it has not started yet.
 * @param user - The player, or null after sign-out.
 */
export function setClientUser(user: { id: string } | null): void {
  startSentryClient();
  Sentry.setUser(user);
}

/**
 * Reports an error caught by an error boundary, starting the SDK first if it has not started yet.
 * @param error - The caught error.
 */
export function reportClientError(error: unknown): void {
  startSentryClient();
  Sentry.captureException(error);
}
