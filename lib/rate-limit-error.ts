/** Start of the message `checkRateLimit` throws; shared by the server, the client and Sentry filtering. */
export const RATE_LIMIT_MESSAGE_PREFIX = "Rate limit exceeded";

/** True for the error `checkRateLimit` throws when an action exceeds its limit. */
export function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith(RATE_LIMIT_MESSAGE_PREFIX)
  );
}
