import { NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Handles the OAuth callback from Supabase.
 * Exchanges the code for a session and then patches the session metadata (IP/User-Agent).
 */
// Validate redirect URL - must start with "/" but not "//" (protocol-relative redirect)
function isValidRedirectUrl(url: string): boolean {
  return /^\/(?!\/)/.test(url);
}

/**
 *
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/";

  // Security: validate redirect URL to prevent open redirect
  if (!isValidRedirectUrl(next)) {
    next = "/";
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Update session metadata with real browser info (replacing "node")
      const userAgent = request.headers.get("user-agent") || "unknown";
      // x-forwarded-for handling (first IP is client)
      const forwardedFor = request.headers.get("x-forwarded-for");
      const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";

      // We use Admin Client because standard client might not have permissions to update user_sessions
      // or the RLS might be strict. It's safer to do this system-level fix here.
      const adminSupabase = createAdminClient();

      // We target the MOST RECENT session for this user that looks like it was created by the server just now
      const recentThreshold = new Date(Date.now() - 30_000).toISOString(); // 30 seconds ago

      // Attempt to update the session to reflect the real device
      await adminSupabase
        .from("user_sessions")
        .update({
          device_info: { user_agent: userAgent },
          ip_address: ip,
        })
        .eq("user_id", data.session.user.id)
        .gte("created_at", recentThreshold)
        // Only replace if it's currently marked as node/server (which it should be from the trigger)
        // This is a safety check to avoid overwriting if for some reason it's already correct.
        .ilike("device_info->>user_agent", "%node%");
      // We can't use order/limit in update easily without a subquery,
      // but given the timestamp constraint and user_id, it should be the right one.

      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocal = origin.includes("localhost");
      if (isLocal) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
