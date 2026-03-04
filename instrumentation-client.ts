import * as Sentry from "@sentry/nextjs";

// Silences Sentry SDK warning about missing export.
// Must NOT reference Sentry.captureRouterTransitionStart directly — that pulls
// tracing code into the bundle despite excludeTracing: true.

/**
 *
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function onRouterTransitionStart() {}

function sanitizePII(data: unknown): unknown {
  if (!data) return data;
  if (typeof data !== "object") return data;

  const sensitive = ["email", "password", "token", "secret", "key"];
  const sanitized = Array.isArray(data)
    ? [...(data as unknown[])]
    : { ...(data as Record<string, unknown>) };

  for (const key of Object.keys(sanitized)) {
    const value = (sanitized as Record<string, unknown>)[key];
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      (sanitized as Record<string, unknown>)[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      (sanitized as Record<string, unknown>)[key] = sanitizePII(value);
    }
  }

  return sanitized;
}

Sentry.init({
  beforeSend(event) {
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
        ...crumb,
        data: crumb.data
          ? (sanitizePII(crumb.data) as Record<string, unknown>)
          : undefined,
      }));
    }

    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    return event;
  },
  debug: false,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [],
  tracesSampleRate: 0,
});
