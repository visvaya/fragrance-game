import { headers } from "next/headers";

/**
 * Client IP for per-IP rate limits in server actions: the first `x-forwarded-for`
 * entry, then `x-real-ip`, else "unknown" (all such requests then share one budget).
 * Trusts the hosting proxy to set the header, which holds on Vercel.
 */
export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  return (
    forwardedFor?.split(",")[0].trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown"
  );
}
