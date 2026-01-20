import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const redis = Redis.fromEnv();

// Global IP limit: 100 requests per minute (DoS protection)
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
});

export async function middleware(request: NextRequest) {
    // Only rate limit API routes and Server Actions (if triggered via POST to /)
    // But strictly speaking, middleware runs on paths.
    // We'll trust the config matcher to apply this only to API routes if desired,
    // or generally to api-like behaviour.

    // Get IP address
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';

    // Execute rate limiting
    const { success, limit, reset, remaining } = await ratelimit.limit(ip);

    if (!success) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                    'X-RateLimit-Reset': reset.toString(),
                },
            }
        );
    }

    // Add security headers to all responses
    const response = NextResponse.next();

    // Content Security Policy
    response.headers.set(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' eu.i.posthog.com eu-assets.i.posthog.com *.ingest.de.sentry.io",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: pub-*.r2.dev *.supabase.co",
            "connect-src 'self' *.supabase.co eu.i.posthog.com *.sentry.io *.upstash.io",
            "font-src 'self' data:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ')
    );

    // Additional security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return response;
}

export const config = {
    matcher: '/api/:path*',
};
