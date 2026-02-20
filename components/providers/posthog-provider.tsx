"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * PostHogProvider handles lazy loading of posthog-js.
 * This prevents posthog from being included in the main bundle,
 * improving initial load performance (TBT, LCP).
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const [PHProvider, setPHProvider] = useState<any>(null);
  const [phClient, setPhClient] = useState<any>(null);

  useEffect(() => {
    const initPostHog = async () => {
      try {
        // Dynamic import posthog-js
        const { default: posthog } = await import("posthog-js");
        const { PostHogProvider: Provider } = await import("posthog-js/react");

        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
          api_host: "/ph-proxy",
          capture_pageview: false,
          disable_session_recording: true,
          loaded: (ph) => {
            if (process.env.NODE_ENV === "development")
              console.log("PostHog (lazy) loaded", ph);
          },
          person_profiles: "identified_only",
          ui_host:
            process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://eu.posthog.com",
        });

        setPhClient(posthog);
        setPHProvider(() => Provider);
      } catch (error) {
        console.error("Failed to load PostHog:", error);
      }
    };

    // Wait for browser idle to load analytics
    if ("requestIdleCallback" in globalThis) {
      (globalThis as any).requestIdleCallback(async () => initPostHog(), {
        timeout: 6000,
      });
    } else {
      setTimeout(initPostHog, 3000);
    }
  }, []);

  // Return children directly until PostHog is loaded to avoid blocking render
  if (!PHProvider || !phClient) {
    return <>{children}</>;
  }

  return <PHProvider client={phClient}>{children}</PHProvider>;
}
