"use client";

import type { ReactNode } from "react";

import { PostHogProvider } from "@/components/providers/posthog-provider";
import { SentryProvider } from "@/components/providers/sentry-provider";

/**
 * Client component wrapper for analytics providers.
 * Both providers initialize lazily via useEffect and always render children,
 * so they are safe to server-render without dynamic(ssr:false).
 */
export function AnalyticsProviders({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <SentryProvider>
      <PostHogProvider>{children}</PostHogProvider>
    </SentryProvider>
  );
}
