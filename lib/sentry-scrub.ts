import type { ErrorEvent } from "@sentry/nextjs";

/** Keys whose values never leave the app: any key containing one of these, in any case. */
const SENSITIVE_KEY_PARTS = ["email", "password", "token", "secret", "key"];

/** Errors the game throws on purpose (anti-replay nonce mismatch, rate limit); not bugs. */
const EXPECTED_ERROR_PREFIXES = ["CONFLICT:", "Rate limit exceeded"];

/**
 * Replaces the values of sensitive keys with "[REDACTED]", at any depth of objects and arrays.
 * @param data - Breadcrumb data or any nested value.
 */
export function redactSensitive(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  const isArray = Array.isArray(data);
  const entries: [string, unknown][] = isArray
    ? (data as unknown[]).map((item, index): [string, unknown] => [
        index.toString(),
        item,
      ])
    : Object.entries(data as Record<string, unknown>);

  const redacted: Record<string, unknown> = Object.fromEntries(
    entries.map(([key, value]): [string, unknown] => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEY_PARTS.some((part) => lowerKey.includes(part))) {
        return [key, "[REDACTED]"];
      }
      if (value !== null && typeof value === "object") {
        return [key, redactSensitive(value)];
      }
      return [key, value];
    }),
  );

  return isArray ? Object.values(redacted) : redacted;
}

/**
 * The `beforeSend` of every Sentry runtime: drops expected business errors, redacts sensitive
 * breadcrumb data and removes the user's email and IP address.
 * @param event - Event about to be sent.
 * @returns The event to send, or null to drop it.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  const message = event.exception?.values?.[0]?.value ?? "";
  if (EXPECTED_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    return null;
  }

  const breadcrumbs = event.breadcrumbs?.map((crumb) =>
    crumb.data
      ? {
          ...crumb,
          data: redactSensitive(crumb.data) as Record<string, unknown>,
        }
      : crumb,
  );
  const { email: _email, ip_address: _ipAddress, ...user } = event.user ?? {};

  return {
    ...event,
    ...(breadcrumbs ? { breadcrumbs } : {}),
    ...(event.user ? { user } : {}),
  };
}
