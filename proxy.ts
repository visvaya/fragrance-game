import { NextRequest, NextResponse } from "next/server";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import createMiddleware from "next-intl/middleware";

import { env } from "@/lib/env";
import { resolveAssetsHost } from "@/lib/game/asset-url";

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
 * Content Security Policy for one response. Scripts run only with this request's nonce or when
 * loaded by such a script ('strict-dynamic'), so an injected inline script is blocked.
 */
function buildContentSecurityPolicy(nonce: string): string {
  const assetsHost = resolveAssetsHost(env.NEXT_PUBLIC_ASSETS_HOST);
  const isDevelopment = env.NODE_ENV === "development";
  // A production build served over plain http (the e2e job runs it on localhost) cannot answer
  // https, so upgrading its own subresources would leave the page without styles and scripts.
  const upgradesInsecureRequests =
    !isDevelopment && !env.SITE_URL?.startsWith("http://");
  return [
    "default-src 'self'",
    // 'unsafe-eval' only in development (React rebuilds server error stacks with eval).
    // The host list is a fallback for browsers without 'strict-dynamic', which ignore it otherwise.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""} va.vercel-scripts.com https://*.posthog.com https://js.sentry-cdn.com https://browser.sentry-cdn.com https://vercel.live https://vercel.com *.ingest.sentry.io https://challenges.cloudflare.com`,
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
    "object-src 'none'",
    ...(upgradesInsecureRequests ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** The request with the nonce and the CSP added, for the page render to read. */
function withPageRequestHeaders(
  request: NextRequest,
  nonce: string,
  contentSecurityPolicy: string,
): NextRequest {
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  return new NextRequest(request, { headers });
}

/**
 * Next.js proxy: rate limit for /api, locale routing, CORS, CSP and security headers.
 * @param request - incoming request
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Short-circuit for internal Next.js paths and static assets
  // This prevents intlMiddleware or other logic from interfering with asset loading
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/db") ||
    pathname.startsWith("/ph-proxy") ||
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

  // 2. Content Security Policy with a fresh nonce per request. Next.js reads the nonce from the
  // request's CSP header while rendering and puts it on its own scripts; the layout reads
  // x-nonce for its inline scripts. Pages are rendered per request, so the nonce is never cached.
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  // 3. Internationalization (next-intl forwards the request headers to the render)
  const response = pathname.startsWith("/api")
    ? NextResponse.next()
    : intlMiddleware(
        withPageRequestHeaders(request, nonce, contentSecurityPolicy),
      );

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
    ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",") : []),
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

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

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
     * 5. the Sentry tunnel (/api/monitoring and its handler /sentry-tunnel): Next.js buffers the
     *    request body for the proxy, so a browser that stops mid-upload would hold it too
     */
    "/((?!api/auth/callback|api/monitoring|sentry-tunnel|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
