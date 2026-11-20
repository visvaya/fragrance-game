"use client";

import type { ReactNode } from "react";

import { PostHogProvider } from "@/components/providers/posthog-provider";

/**
 * Client component wrapper for analytics providers. PostHog initializes lazily and always
 * renders children, so it is safe to server-render without dynamic(ssr:false). Sentry starts
 * from instrumentation-client.ts.
 */
export function AnalyticsProviders({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <PostHogProvider>{children}</PostHogProvider>;
}
