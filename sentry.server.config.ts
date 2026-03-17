import * as Sentry from "@sentry/nextjs";

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
      if (isSensitive) return [key, "[REDACTED]"];
      if (value !== null && typeof value === "object")
        return [key, sanitizePII(value)];
      return [key, value];
    }),
  );

  return isArray ? Object.values(sanitized) : sanitized;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Disable in local development — dev errors pollute the project with noise
  // and hide real production issues. Vercel preview/production still captured.
  enabled: process.env.NODE_ENV !== "development",

  tracesSampleRate: 0.1,
  debug: false,

  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value ?? "";

    // Filter expected business-logic errors — these are not bugs
    if (
      message.startsWith("CONFLICT:") || // nonce mismatch (anti-replay)
      message.startsWith("Rate limit exceeded") // expected rate limiting
    ) {
      return null;
    }

    // Sanitize PII from breadcrumbs
    const breadcrumbs = event.breadcrumbs
      ? event.breadcrumbs.map((crumb) => ({
          ...crumb,
          data: crumb.data
            ? (sanitizePII(crumb.data) as Record<string, unknown>)
            : undefined,
        }))
      : undefined;

    // Remove PII from user context
    const user = event.user
      ? { ...event.user, email: undefined, ip_address: undefined }
      : undefined;

    return { ...event, breadcrumbs, user };
  },
});
