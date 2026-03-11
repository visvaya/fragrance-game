import * as Sentry from "@sentry/nextjs";

// Silences Sentry SDK warning about missing export.
// Must NOT reference Sentry.captureRouterTransitionStart directly — that pulls
// tracing code into the bundle despite excludeTracing: true.

/**
 *
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional empty export; must not reference Sentry API to avoid pulling tracing code into the bundle
export function onRouterTransitionStart() {}

function sanitizePII(data: unknown): unknown {
  if (!data) return data;
  if (typeof data !== "object") return data;

  const sensitive = ["email", "password", "token", "secret", "key"];
  const isArray = Array.isArray(data);
  const entries: [string, unknown][] = isArray
    ? (data as unknown[]).map((item, idx): [string, unknown] => [
        idx.toString(),
        item,
      ])
    : Object.entries(data as Record<string, unknown>);

  const sanitized: Record<string, unknown> = Object.fromEntries(
    entries.map(([key, value]): [string, unknown] => {
      const isSensitive = sensitive.some((s) => key.toLowerCase().includes(s));
      if (isSensitive) {
        return [key, "[REDACTED]"];
      }
      if (value !== null && typeof value === "object") {
        return [key, sanitizePII(value)];
      }
      return [key, value];
    }),
  );

  return isArray ? Object.values(sanitized) : sanitized;
}

Sentry.init({
  beforeSend(event) {
    const breadcrumbs = event.breadcrumbs
      ? event.breadcrumbs.map((crumb) => ({
          ...crumb,
          data: crumb.data
            ? (sanitizePII(crumb.data) as Record<string, unknown>)
            : undefined,
        }))
      : undefined;

    const user = event.user
      ? {
          ...event.user,
          email: undefined,
          ip_address: undefined,
        }
      : undefined;

    return {
      ...event,
      breadcrumbs,
      user,
    };
  },
  debug: false,
  // eslint-disable-next-line no-restricted-properties -- Sentry initialization requires process.env
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [],
  tracesSampleRate: 0,
});
