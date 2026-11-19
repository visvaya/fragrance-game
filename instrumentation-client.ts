import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/sentry-scrub";

// Silences Sentry SDK warning about missing export.
// Must NOT reference Sentry.captureRouterTransitionStart directly — that pulls
// tracing code into the bundle despite excludeTracing: true.

/**
 * Callback triggered when router transition starts.
 * Intentionally empty to silence Sentry warnings without pulling tracing code.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional empty export; must not reference Sentry API to avoid pulling tracing code into the bundle
export function onRouterTransitionStart() {}

Sentry.init({
  beforeSend: scrubEvent,
  debug: false,
  // eslint-disable-next-line no-restricted-properties -- Sentry initialization requires process.env
  dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  // eslint-disable-next-line no-restricted-properties -- NODE_ENV is needed for build-time dead-code elimination; env.NODE_ENV indirection prevents tree-shaking
  enabled: process.env.NODE_ENV !== "development",
  integrations: [],
  tracesSampleRate: 0,
});
