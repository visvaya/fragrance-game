"use client";

import {
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

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

async function initPostHog(
  setPhClient: (client: unknown) => void,
  setPhProvider: Dispatch<SetStateAction<React.ElementType | null>>,
) {
  try {
    // Dynamic import posthog-js
    const { default: posthog } = await import("posthog-js");
    const { PostHogProvider: Provider } = await import("posthog-js/react");

    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      advanced_disable_feature_flags: true,
      api_host: "/ph-proxy",
      autocapture: false,
      capture_pageview: false,
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

    setPhClient(posthog);
    // eslint-disable-next-line fp/no-mutation -- module-level singleton, set once after PostHog initializes
    _posthogInstance = posthog;
    setPhProvider(() => Provider);
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
  const [phProvider, setPhProvider] = useState<React.ElementType | null>(null);
  const [phClient, setPhClient] = useState<unknown>(null);

  useMountEffect(() => {
    let triggered = false;

    const load = () => {
      if (triggered) return;
      // eslint-disable-next-line fp/no-mutation -- necessary for single-fire pattern
      triggered = true;
      cleanup();
      void initPostHog(setPhClient, setPhProvider);
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
  }, []);

  // Return children directly until PostHog is loaded to avoid blocking render
  if (phProvider === null || phClient === null) {
    return <>{children}</>;
  }

  const ProviderComponent = phProvider;
  return (
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- PostHog provider is dynamically imported; client prop type not exported by posthog-js; any cast unavoidable
    <ProviderComponent client={phClient as any}>{children}</ProviderComponent>
  );
}
