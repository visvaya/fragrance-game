import { whenIdle } from "@/components/game/when-idle";
import { disableZodJit } from "@/lib/zod-jitless";

/** Longest wait before the error reporter starts when the player neither interacts nor idles. */
const SENTRY_START_TIMEOUT_MS = 4000;

disableZodJit();

// Silences Sentry SDK warning about missing export.
// Must NOT reference Sentry.captureRouterTransitionStart directly – that pulls
// tracing code into the bundle despite excludeTracing: true.

/**
 * Callback triggered when router transition starts.
 * Intentionally empty to silence Sentry warnings without pulling tracing code.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional empty export; must not reference Sentry API to avoid pulling tracing code into the bundle
export function onRouterTransitionStart() {}

// The SDK (about 85 KB compressed) would otherwise load and run before hydration. Errors thrown
// before it starts go unreported; the start-up path has its own error states in the UI.
whenIdle(() => {
  void import("@/lib/sentry-client").then(({ startSentryClient }) => {
    startSentryClient();
    return null;
  });
}, SENTRY_START_TIMEOUT_MS);
