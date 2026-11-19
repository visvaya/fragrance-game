import { test, expect } from "@playwright/test";

test.describe("Middleware Security Headers", () => {
  test("response includes all required security headers", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const headers = response?.headers();

    // X-Frame-Options
    expect(headers?.["x-frame-options"]).toBe("DENY");

    // X-Content-Type-Options
    expect(headers?.["x-content-type-options"]).toBe("nosniff");

    // X-XSS-Protection
    expect(headers?.["x-xss-protection"]).toBe("1; mode=block");

    // Referrer-Policy
    expect(headers?.["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );

    // Content-Security-Policy
    const csp = headers?.["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");

    // Permissions-Policy
    const permissionsPolicy = headers?.["permissions-policy"];
    expect(permissionsPolicy).toBeTruthy();
    expect(permissionsPolicy).toContain("camera=()");
    expect(permissionsPolicy).toContain("microphone=()");
    expect(permissionsPolicy).toContain("geolocation=()");
  });

  test("CSP allows required external domains", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const csp = response?.headers()["content-security-policy"];
    expect(csp).toBeTruthy();

    // Verify whitelisted domains for scripts and connections
    expect(csp).toContain("*.posthog.com");
    expect(csp).toContain("*.sentry.io");
    expect(csp).toContain("*.supabase.co");
    expect(csp).toContain("*.upstash.io");
    expect(csp).toContain("va.vercel-scripts.com");
  });

  test("API routes have no-store Cache-Control header", async ({ request }) => {
    const response = await request.get("/api/healthcheck");

    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toBe(
      "no-store, max-age=0, must-revalidate",
    );
  });

  test("static assets bypass the proxy and its security headers", async ({
    request,
  }) => {
    // The proxy matcher excludes /_next/static, so even a missing asset gets no proxy headers.
    const response = await request.get("/_next/static/test.js");

    expect(response.status()).toBeLessThan(500);
    expect(response.headers()["x-frame-options"]).toBeUndefined();
  });
});

test.describe("CORS Configuration", () => {
  test("allows requests from localhost origin", async ({ request }) => {
    const response = await request.get("/", {
      headers: {
        origin: "http://localhost:3000",
      },
    });

    expect(response.ok()).toBeTruthy();
    expect(response.headers()["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers()["access-control-allow-methods"]).toContain("GET");
    expect(response.headers()["access-control-allow-methods"]).toContain(
      "POST",
    );
  });

  test("blocks requests from unauthorized origins", async ({ request }) => {
    const response = await request.get("/", {
      headers: {
        origin: "http://evil.com",
      },
    });

    // Request should succeed (middleware doesn't block it),
    // but CORS headers should NOT be set
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
  });
});

test.describe("CSP Enforcement", () => {
  test("CSP forbids eval outside development", async ({ request }) => {
    // The dev server adds 'unsafe-eval' for React Refresh; CI runs the production build.
    test.skip(!process.env.CI, "The local dev server allows eval.");
    const response = await request.get("/en");

    expect(response.headers()["content-security-policy"]).not.toContain(
      "'unsafe-eval'",
    );
  });

  test("allows whitelisted external scripts", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");

    // Verify page loads without CSP blocking legitimate resources
    // If CSP was too strict, page would fail to load
    expect(errors).toHaveLength(0);
  });
});
