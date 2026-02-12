"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Lazy load analytics providers - improves TBT by ~300-500ms
// These are non-critical for initial render and can load after hydration
const PostHogProvider = dynamic(
  () =>
    import("@/components/providers/posthog-provider").then(
      (mod) => mod.PostHogProvider,
    ),
  { ssr: false },
);

const SentryProvider = dynamic(
  () =>
    import("@/components/providers/sentry-provider").then(
      (mod) => mod.SentryProvider,
    ),
  { ssr: false },
);

/**
 * Client component wrapper for lazy-loaded analytics providers.
 * Extracted to separate file because dynamic() with ssr:false
 * can only be used in Client Components.
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
