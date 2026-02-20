import { NextResponse, type NextRequest } from "next/server";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

const redis = Redis.fromEnv();

const intlMiddleware = createMiddleware(routing);

// Global IP limit: 100 requests per minute (DoS protection)
const ratelimit = new Ratelimit({
  analytics: true,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  redis,
});

/**
 *
 * @param request
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Short-circuit for internal Next.js paths and static assets
  // This prevents intlMiddleware or other logic from interfering with asset loading
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/db") ||
    pathname.startsWith("/ph-proxy") ||
    pathname.startsWith("/api/monitoring") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 1. Rate Limiting
  // Only rate limit API routes
  if (pathname.startsWith("/api")) {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { limit, remaining, reset, success } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        {
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
          status: 429,
        },
      );
    }
  }

  // 2. Internationalization
  let response: NextResponse;

  response = pathname.startsWith("/api")
    ? NextResponse.next()
    : intlMiddleware(request);

  // Cache-Control for sensitive routes
  if (pathname.startsWith("/api")) {
    response.headers.set(
      "Cache-Control",
      "no-store, max-age=0, must-revalidate",
    );
  }

  // CORS Configuration
  const origin = request.headers.get("origin");
  const allowedOrigins = [
    "http://localhost:3000",
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : []),
    "https://eauxle.vercel.app",
    "https://eauxle.com",
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Supabase-Auth",
    );
  }

  // Content Security Policy
  const assetsHost =
    process.env.NEXT_PUBLIC_ASSETS_HOST ||
    "pub-2c37ff9f03ea40878492e7f72ef83fe3.r2.dev";

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // 'unsafe-eval' is restricted to development only (needed by webpack HMR).
      // 'unsafe-inline' is required by PostHog, Sentry CDN, and Vercel analytics.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} va.vercel-scripts.com https://*.posthog.com https://js.sentry-cdn.com https://browser.sentry-cdn.com https://vercel.live https://vercel.com *.ingest.sentry.io https://challenges.cloudflare.com`,
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' blob: data: https://*.r2.dev https://${assetsHost} https://placehold.co https://*.posthog.com`,
      "connect-src 'self' https://*.supabase.co https://*.upstash.io https://*.posthog.com https://*.sentry.io https://sentry.io https://challenges.cloudflare.com",
      "font-src 'self' data:",
      "frame-src 'self' https://challenges.cloudflare.com https://vercel.live https://vercel.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  );

  // Additional security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );

  return response;
}

// Next.js 16 supports both named export 'proxy' and default export.
export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /api/auth/callback/ (handled by Supabase Auth Helpers automatic routing if needed)
     * 2. /_next/ (Next.js internals)
     * 3. /favicon.ico, /sitemap.xml, robotics.txt
     * 4. all files ending in static extensions
     */
    "/((?!api/auth/callback|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
