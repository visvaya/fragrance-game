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

export async function proxy(request: NextRequest) {
    // Only rate limit API routes
    if (request.nextUrl.pathname.startsWith('/api')) {
        const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
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
    }

    // Add security headers to all responses
    const response = NextResponse.next();

    // Cache-Control for sensitive routes
    if (request.nextUrl.pathname.startsWith('/api')) {
        response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    }

    // CORS Configuration
    const origin = request.headers.get('origin');
    const allowedOrigins = [
        'http://localhost:3000',
        'https://eauxle.vercel.app',
        'https://eauxle.com',
        'https://fragrance-game.vercel.app' // Legacy/Preview domains if needed
    ];

    if (origin && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Supabase-Auth');
    }

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
    matcher: [
        /*
         * Match all request paths except for:
         * 1. /api/auth/callback/ (handled by Supabase Auth Helpers automatic routing if needed, though usually fine to have headers)
         * 2. /_next/ (Next.js internals)
         * 3. /_static (inside /public)
         * 4. /favicon.ico, /sitemap.xml, /robots.txt (static files)
         * 5. all root files ending in .svg, .png, .jpg, .jpeg, .gif, .webp
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
