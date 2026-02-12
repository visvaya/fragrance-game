"use client";

import { useEffect } from "react";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

/**
 *
 * @param root0
 * @param root0.children
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Delay PostHog init to reduce TBT
    // Delay PostHog init to reduce TBT - wait for browser idle
    const handleInit = () => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: "/ph-proxy",
        capture_pageview: false,
        disable_session_recording: true,
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development")
            console.log("PostHog loaded", ph);
        },
        person_profiles: "identified_only",
        ui_host:
          process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://eu.posthog.com",
      });
    };

    let timerId: any;
    // Use requestIdleCallback if available, otherwise fallback to timeout
    // Increased timeout to 6000ms to further reduce main thread blocking
    if ("requestIdleCallback" in globalThis) {
      (globalThis as any).requestIdleCallback(handleInit, { timeout: 6000 });
    } else {
      timerId = setTimeout(handleInit, 3000);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
