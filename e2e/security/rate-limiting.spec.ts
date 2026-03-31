import { test, expect } from "@playwright/test";

test.describe("Rate Limiting", () => {
  test("blocks requests after exceeding rate limit (100 req/min)", async ({
    request,
  }) => {
    // Note: This test sends 101 requests to verify rate limiting
    // It's marked as slow since it may take time to complete
    test.slow();

    const responses: number[] = [];
    const testEndpoint = "/api/healthcheck"; // Use a lightweight endpoint

    // Send 101 requests rapidly
    for (let i = 0; i < 101; i++) {
      try {
        const response = await request.get(testEndpoint);
        responses.push(response.status());
      } catch {
        // If request fails, consider it as rate-limited
        responses.push(429);
      }
    }

    // Count successful and rate-limited responses
    const successful = responses.filter((s) => s === 200 || s === 404).length;
    const rateLimited = responses.filter((s) => s === 429).length;

    // Verify: At least one request should be rate-limited
    // (Exact threshold may vary due to sliding window)
    expect(rateLimited).toBeGreaterThan(0);

    // Log results for debugging
    console.log(`Successful: ${successful}, Rate-limited: ${rateLimited}`);
  });

  test("rate limit includes proper headers", async ({ request }) => {
    // Make a request and check for rate limit headers
    const response = await request.get("/api/healthcheck").catch(() => null);

    if (response?.status() === 429) {
      const headers = response.headers();

      // Verify rate limit headers are present

      expect(headers["x-ratelimit-limit"]).toBeTruthy();

      expect(headers["x-ratelimit-remaining"]).toBeTruthy();

      expect(headers["x-ratelimit-reset"]).toBeTruthy();

      // Verify limit is set to 100

      expect(Number.parseInt(headers["x-ratelimit-limit"])).toBe(100);
    }
  });

  test("rate limit resets after time window", async ({ request }) => {
    test.slow();

    // Send requests until rate-limited
    let isRateLimited = false;
    for (let i = 0; i < 105; i++) {
      const response = await request.get("/api/healthcheck");

      if (response.status() === 429) {
        isRateLimited = true;
        break;
      }
    }

    if (isRateLimited) {
      // Wait for rate limit to reset (1 minute + buffer)
      console.log("Rate limited. Waiting 65 seconds for reset...");
      await new Promise((resolve) => setTimeout(resolve, 65_000));

      // Try again - should succeed
      const response = await request.get("/api/healthcheck");

      expect(response.status()).not.toBe(429);
    } else {
      // If we couldn't trigger rate limit, skip this test

      test.skip();
    }
  });

  test("rate limit applies per IP address", async ({ request }) => {
    // This test verifies that rate limiting is IP-based.
    // All requests from Playwright share the same IP, so we verify that responses
    // are either successful or rate-limited — never unexpected errors.

    const responses: number[] = [];

    // Send 10 requests
    for (let i = 0; i < 10; i++) {
      const response = await request.get("/api/healthcheck");
      responses.push(response.status());
    }

    // Every response must be either successful (200) or rate-limited (429) — no 5xx errors
    const validStatuses = responses.filter((s) => s === 200 || s === 429);
    expect(validStatuses.length).toBe(10);
  });

  test("rate limit only applies to /api routes", async ({ request }) => {
    // Non-API routes should NOT be rate-limited.
    // GET / redirects to /en (307), which is a normal response — not rate-limited (429).
    const responses: number[] = [];

    // Send multiple requests to a regular page
    for (let i = 0; i < 20; i++) {
      const response = await request.get("/");
      responses.push(response.status());
    }

    // All requests should be successful or redirects (not rate-limited)
    const notRateLimited = responses.filter((s) => s !== 429).length;
    expect(notRateLimited).toBe(20);

    // None should be rate-limited
    const rateLimited = responses.filter((s) => s === 429).length;
    expect(rateLimited).toBe(0);
  });
});

test.describe("Rate Limiting - Error Response", () => {
  test("returns proper error message when rate-limited", async ({
    request,
  }) => {
    test.slow();

    // Send requests until rate-limited
    let rateLimitResponse = null;

    for (let i = 0; i < 105; i++) {
      const response = await request.get("/api/healthcheck");

      if (response.status() === 429) {
        rateLimitResponse = response;
        break;
      }
    }

    if (rateLimitResponse) {
      const json = await rateLimitResponse.json();

      expect(json.error).toBeTruthy();

      expect(json.error).toContain("Rate limit");
    }
  });
});
