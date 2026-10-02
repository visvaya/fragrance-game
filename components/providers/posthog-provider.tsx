"use client";

import type { ReactNode } from "react";

import { env } from "@/lib/env";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";

// Module-level ref — set when PostHog initializes, used by captureAnalyticsEvent
let _posthogInstance: {
  capture: (event: string, props?: Record<string, unknown>) => void;
} | null = null;

/**
 * Capture an analytics event without requiring React context.
 * No-op if PostHog hasn't loaded yet — events are dropped silently before initialization.
 */
export function captureAnalyticsEvent(
  event: string,
  props?: Record<string, unknown>,
): void {
  _posthogInstance?.capture(event, props);
}

/**
 * PostHogProvider handles lazy loading of posthog-js.
 * This prevents posthog from being included in the main bundle,
 * improving initial load performance (TBT, LCP).
 */

async function initPostHog() {
  try {
    // Dynamic import posthog-js
    const { default: posthog } = await import("posthog-js");

    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      advanced_disable_feature_flags: true,
      api_host: "/ph-proxy",
      autocapture: false,
      // Page views and page leaves are the only traffic metrics; "history_change" also covers client-side navigation.
      capture_pageview: "history_change",
      disable_external_dependency_loading: true,
      disable_session_recording: true,
      disable_surveys: true,
      enable_heatmaps: false,
      loaded: (ph) => {
        // eslint-disable-next-line no-restricted-properties -- process.env.NODE_ENV enables bundler dead-code elimination; env.NODE_ENV indirection prevents tree-shaking of this debug log
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console -- debug-only log, gated by NODE_ENV
          console.debug("PostHog (lazy) loaded", ph);
        }
      },
      opt_in_site_apps: false,
      person_profiles: "identified_only",
      ui_host: env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? "https://eu.posthog.com",
    });

    // eslint-disable-next-line fp/no-mutation -- module-level singleton, set once after PostHog initializes
    _posthogInstance = posthog;
  } catch (error) {
    console.error("Failed to load PostHog:", error);
  }
}

/**
 * PostHogProvider handles lazy loading of posthog-js.
 * This prevents posthog from being included in the main bundle,
 * improving initial load performance (TBT, LCP).
 */
export function PostHogProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  useMountEffect(() => {
    let triggered = false;

    const load = () => {
      if (triggered) return;
      // eslint-disable-next-line fp/no-mutation -- necessary for single-fire pattern
      triggered = true;
      cleanup();
      void initPostHog();
    };

    const events = ["click", "scroll", "keydown", "touchstart"] as const;
    const options: AddEventListenerOptions = { once: true, passive: true };

    for (const event of events) {
      // eslint-disable-next-line react-web-api/no-leaked-event-listener -- cleanup defined below, returned as useEffect cleanup; once:true also auto-removes
      globalThis.addEventListener(event, load, options);
    }

    // Safety net: if no interaction after 15s, load anyway
    const timer = setTimeout(load, 15_000);

    const cleanup = () => {
      clearTimeout(timer);
      for (const event of events) {
        globalThis.removeEventListener(event, load);
      }
    };

    return cleanup;
  });

  // The tree must stay identical before and after PostHog loads: wrapping children in
  // posthog-js/react's provider once it arrived remounted the whole app and reset game
  // state mid-move. Events go through captureAnalyticsEvent, so no React context is needed.
  return <>{children}</>;
}
