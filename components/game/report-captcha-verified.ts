import type { RefObject } from "react";

import { captureAnalyticsEvent } from "@/components/providers/posthog-provider";

/**
 * Sends how long the Turnstile check took (from `startedAt`, a `performance.now()` value) and
 * whether the player saw the dialog meanwhile. Clears `startedAt`, so it reports once per page.
 */
export function reportCaptchaVerified(
  startedAt: RefObject<number | null>,
  stage: string,
): void {
  if (startedAt.current === null) return;
  captureAnalyticsEvent("captcha_verified", {
    duration_ms: Math.round(performance.now() - startedAt.current),
    stage,
  });
  startedAt.current = null;
}
