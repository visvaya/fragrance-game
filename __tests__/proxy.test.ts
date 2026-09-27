import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mock references — must be created before any vi.mock() factory runs.
// vi.hoisted() values can be closed over inside vi.mock() factories.
// ---------------------------------------------------------------------------
const { mockIntlHandler, mockRatelimitLimit } = vi.hoisted(() => {
  const intlHandler = vi.fn().mockImplementation(() => {
    // Return a minimal response-like object with a mutable Headers instance.
    // proxy.ts calls response.headers.set(...) on whatever intlMiddleware returns.
    return { headers: new Headers(), status: 200 };
  });

  const ratelimitLimit = vi.fn().mockResolvedValue({
    limit: 100,
    remaining: 99,
    reset: Date.now() + 60_000,
    success: true,
  });

  return { mockIntlHandler: intlHandler, mockRatelimitLimit: ratelimitLimit };
});

// @upstash/redis is globally mocked in vitest.setup.ts (Redis.fromEnv).
// @upstash/ratelimit must be mocked here because proxy.ts uses it directly.
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static readonly slidingWindow = vi.fn().mockReturnValue({} as any);
    limit = mockRatelimitLimit;
  },
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn().mockReturnValue(mockIntlHandler),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ALLOWED_ORIGINS: "",
    NEXT_PUBLIC_ASSETS_HOST: "assets.example.com",
    NODE_ENV: "production",
  },
}));

vi.mock("@/i18n/routing", () => ({
  routing: {},
}));

// Import proxy AFTER mocks are registered (mocks are hoisted, but the
// explicit placement after vi.mock() calls makes the order intentional).
import { proxy } from "@/proxy";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_IP = "127.0.0.1";

function makeRequest(
  path: string,
  options: { headers?: Record<string, string>; method?: string } = {},
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: options.headers,
    method: options.method ?? "GET",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default: rate limit succeeds
    mockRatelimitLimit.mockResolvedValue({
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
      success: true,
    });
    // Restore default: intl handler returns a fresh response each call
    mockIntlHandler.mockImplementation(() => ({
      headers: new Headers(),
      status: 200,
    }));
  });

  // -------------------------------------------------------------------------
  // 1. Bypass paths — early return, no headers added, rate limit not called
  // -------------------------------------------------------------------------
  describe("bypass paths (short-circuit before any middleware logic)", () => {
    it("bypasses /_next/ paths", async () => {
      const response = await proxy(makeRequest("/_next/static/chunk.abc.js"));

      expect(mockRatelimitLimit).not.toHaveBeenCalled();
      expect(mockIntlHandler).not.toHaveBeenCalled();
      // Security headers must NOT be present on bypassed responses
      expect(response.headers.get("X-Frame-Options")).toBeNull();
    });

    it("bypasses /api/db paths", async () => {
      const response = await proxy(makeRequest("/api/db/query"));

      expect(mockRatelimitLimit).not.toHaveBeenCalled();
      expect(response.headers.get("X-Frame-Options")).toBeNull();
    });

    it("bypasses /ph-proxy paths", async () => {
      const response = await proxy(makeRequest("/ph-proxy/e/capture"));

      expect(mockRatelimitLimit).not.toHaveBeenCalled();
      expect(response.headers.get("X-Frame-Options")).toBeNull();
    });

    it("bypasses /api/monitoring paths", async () => {
      const response = await proxy(makeRequest("/api/monitoring/health"));

      expect(mockRatelimitLimit).not.toHaveBeenCalled();
      expect(response.headers.get("X-Frame-Options")).toBeNull();
    });

    it.each([
      ["/logo.svg", "SVG"],
      ["/cover.png", "PNG"],
      ["/photo.jpg", "JPG"],
      ["/photo.jpeg", "JPEG"],
      ["/animated.gif", "GIF"],
      ["/hero.webp", "WebP"],
      ["/favicon.ico", "ICO"],
      ["/font.woff", "WOFF"],
      ["/font.woff2", "WOFF2"],
    ])("bypasses static asset %s (%s)", async (path) => {
      const response = await proxy(makeRequest(path));

      expect(mockRatelimitLimit).not.toHaveBeenCalled();
      expect(response.headers.get("X-Frame-Options")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Rate limiting
  // -------------------------------------------------------------------------
  describe("rate limiting", () => {
    it("does NOT rate limit non-API routes", async () => {
      await proxy(makeRequest("/en/game"));

      expect(mockRatelimitLimit).not.toHaveBeenCalled();
    });

    it("rate limits /api routes using x-forwarded-for header", async () => {
      await proxy(
        makeRequest("/api/game/guess", {
          headers: { "x-forwarded-for": MOCK_IP },
        }),
      );

      expect(mockRatelimitLimit).toHaveBeenCalledWith(MOCK_IP);
    });

    it("uses 'unknown' as IP identifier when x-forwarded-for is absent", async () => {
      await proxy(makeRequest("/api/game/guess"));

      expect(mockRatelimitLimit).toHaveBeenCalledWith("unknown");
    });

    it("returns 429 when rate limit is exceeded", async () => {
      mockRatelimitLimit.mockResolvedValueOnce({
        limit: 100,
        remaining: 0,
        reset: 1_700_000_000,
        success: false,
      });

      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.status).toBe(429);
    });

    it("includes X-RateLimit-Limit header in 429 response", async () => {
      mockRatelimitLimit.mockResolvedValueOnce({
        limit: 100,
        remaining: 0,
        reset: 1_700_000_000,
        success: false,
      });

      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
    });

    it("includes X-RateLimit-Remaining header in 429 response", async () => {
      mockRatelimitLimit.mockResolvedValueOnce({
        limit: 100,
        remaining: 0,
        reset: 1_700_000_000,
        success: false,
      });

      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("returns JSON error body when rate limit is exceeded", async () => {
      mockRatelimitLimit.mockResolvedValueOnce({
        limit: 100,
        remaining: 0,
        reset: 1_700_000_000,
        success: false,
      });

      const response = await proxy(makeRequest("/api/game/guess"));
      const body = await response.json();

      expect(body).toHaveProperty("error");
      expect(typeof body.error).toBe("string");
    });

    it("allows request through when rate limit succeeds", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.status).not.toBe(429);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Routing: intlMiddleware vs NextResponse.next()
  // -------------------------------------------------------------------------
  describe("routing delegation", () => {
    it("delegates non-API routes to intlMiddleware", async () => {
      await proxy(makeRequest("/en/game"));

      expect(mockIntlHandler).toHaveBeenCalledOnce();
    });

    it("does NOT call intlMiddleware for API routes", async () => {
      await proxy(makeRequest("/api/game/guess"));

      expect(mockIntlHandler).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Cache-Control header
  // -------------------------------------------------------------------------
  describe("Cache-Control header", () => {
    it("sets no-store Cache-Control for API routes", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("Cache-Control")).toBe(
        "no-store, max-age=0, must-revalidate",
      );
    });

    it("does NOT set Cache-Control for non-API routes", async () => {
      const response = await proxy(makeRequest("/en/game"));

      expect(response.headers.get("Cache-Control")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 5. CORS headers
  // -------------------------------------------------------------------------
  describe("CORS headers", () => {
    it("sets Access-Control-Allow-Origin for localhost:3000", async () => {
      const response = await proxy(
        makeRequest("/api/game/guess", {
          headers: { origin: "http://localhost:3000" },
        }),
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
    });

    it("sets Access-Control-Allow-Methods for allowed origin", async () => {
      const response = await proxy(
        makeRequest("/api/game/guess", {
          headers: { origin: "https://eauxle.com" },
        }),
      );

      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET",
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "POST",
      );
    });

    it("sets Access-Control-Allow-Headers for allowed origin", async () => {
      const response = await proxy(
        makeRequest("/api/game/guess", {
          headers: { origin: "https://eauxle.com" },
        }),
      );

      expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
        "Content-Type",
      );
    });

    it("does NOT set CORS headers for disallowed origin", async () => {
      const response = await proxy(
        makeRequest("/api/game/guess", {
          headers: { origin: "https://evil.example.com" },
        }),
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("does NOT set CORS headers when origin header is absent", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Content Security Policy
  // -------------------------------------------------------------------------
  describe("Content-Security-Policy header", () => {
    it("sets CSP header on all non-bypass responses", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
    });

    it("CSP includes default-src 'self'", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));
      const csp = response.headers.get("Content-Security-Policy") ?? "";

      expect(csp).toContain("default-src 'self'");
    });

    it("CSP includes frame-ancestors 'none' (clickjacking protection)", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));
      const csp = response.headers.get("Content-Security-Policy") ?? "";

      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("CSP includes upgrade-insecure-requests in production", async () => {
      // env mock has NODE_ENV: "production"
      const response = await proxy(makeRequest("/api/game/guess"));
      const csp = response.headers.get("Content-Security-Policy") ?? "";

      expect(csp).toContain("upgrade-insecure-requests");
    });

    it("CSP does NOT include unsafe-eval in production", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));
      const csp = response.headers.get("Content-Security-Policy") ?? "";

      expect(csp).not.toContain("'unsafe-eval'");
    });

    it("CSP includes configured assets host in img-src", async () => {
      // env mock has NEXT_PUBLIC_ASSETS_HOST: "assets.example.com"
      const response = await proxy(makeRequest("/api/game/guess"));
      const csp = response.headers.get("Content-Security-Policy") ?? "";

      expect(csp).toContain("assets.example.com");
    });
  });

  // -------------------------------------------------------------------------
  // 7. Security headers
  // -------------------------------------------------------------------------
  describe("security headers", () => {
    it("sets X-Frame-Options: DENY", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("sets X-Content-Type-Options: nosniff", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("sets X-XSS-Protection: 1; mode=block", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    });

    it("sets Referrer-Policy: strict-origin-when-cross-origin", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));

      expect(response.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    });

    it("sets Permissions-Policy restricting sensitive APIs", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));
      const policy = response.headers.get("Permissions-Policy") ?? "";

      expect(policy).toContain("camera=()");
      expect(policy).toContain("microphone=()");
      expect(policy).toContain("geolocation=()");
    });

    it("sets Strict-Transport-Security with long max-age", async () => {
      const response = await proxy(makeRequest("/api/game/guess"));
      const hsts = response.headers.get("Strict-Transport-Security") ?? "";

      expect(hsts).toContain("max-age=31536000");
      expect(hsts).toContain("includeSubDomains");
    });
  });
});
