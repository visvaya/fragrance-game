/**
 * Why a Turnstile check failed, as far as the player can act on it; each kind has a text in
 * `Auth.captchaErrors`. "unsupported" comes from the browser check and a script that did not
 * load counts as "blocked"; the rest is read from Cloudflare's error code.
 */
export type TurnstileErrorKind =
  | "blocked"
  | "challenge"
  | "clock"
  | "config"
  | "timeout"
  | "unknown"
  | "unsupported";

/**
 * Reads a Turnstile client error code. Codes and meanings from Cloudflare's error code table
 * (developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/, page
 * dated 2026-09-25); codes ending in `*` there vary in the trailing digits.
 * @param code - The code Turnstile passes to its error callback.
 */
export function turnstileErrorKind(
  code: string | undefined,
): TurnstileErrorKind {
  if (!code) return "unknown";
  // Generic challenge failure ("bot behavior detected"): private windows, blocking
  // extensions and open developer tools are the usual causes, retry is allowed.
  if (code.startsWith("300") || code.startsWith("600")) return "challenge";
  if (code === "200500") return "blocked";
  if (code === "110600" || code === "200100") return "clock";
  if (code === "110620") return "timeout";
  if (code.startsWith("1101") || code.startsWith("1102")) return "config";
  if (code.startsWith("4000")) return "config";
  return "unknown";
}
