import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// function to sanitize PII from Sentry events
function sanitizePII(data: any): any {
  if (!data) return data;
  if (typeof data !== "object") return data;

  const sensitive = ["email", "password", "token", "secret", "key"];
  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key of Object.keys(sanitized)) {
    const value = sanitized[key];
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitizePII(value);
    }
  }

  return sanitized;
}

Sentry.init({
  beforeSend(event, hint) {
    // Remove PII from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
        ...crumb,
        data: crumb.data ? sanitizePII(crumb.data) : undefined,
      }));
    }

    // Remove email from user context
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    return event;
  },

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [],

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,
});
