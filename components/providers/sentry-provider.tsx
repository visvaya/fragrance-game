"use client";

/**
 * Passthrough provider. Sentry is initialized eagerly in instrumentation-client.ts
 * (loaded synchronously by Next.js client entry point).
 * This component exists to keep the provider tree stable — no lazy loading needed.
 */
export function SentryProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
