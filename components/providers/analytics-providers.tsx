"use client";

import type { ReactNode } from "react";

import dynamic from "next/dynamic";

// Lazy load analytics providers - improves TBT by ~300-500ms
// These are non-critical for initial render and can load after hydration
const PostHogProvider = dynamic(
  async () =>
    import("@/components/providers/posthog-provider").then(
      (module_) => module_.PostHogProvider,
    ),
  { ssr: false },
);

const SentryProvider = dynamic(
  async () =>
    import("@/components/providers/sentry-provider").then(
      (module_) => module_.SentryProvider,
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
