import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

const HEALTHCHECK_PATH = "/api/healthcheck";
// The proxy allows 100 requests per minute per IP on /api routes (sliding window).
const RATE_LIMIT_PER_MINUTE = 100;
// Twice the limit: when a window boundary passes mid-loop, the sliding window weights the
// previous window down, so the limit is reached later than after 100 requests.
const REQUEST_BUDGET = RATE_LIMIT_PER_MINUTE * 2;
const WINDOW_RESET_WAIT_MS = 65_000;

/**
 * Sends health check requests until the proxy answers 429, and returns that response; returns
 * undefined when the budget runs out first.
 */
async function requestUntilRateLimited(
  request: APIRequestContext,
): Promise<APIResponse | undefined> {
  for (let i = 0; i < REQUEST_BUDGET; i++) {
    const response = await request.get(HEALTHCHECK_PATH);
    if (response.status() === 429) return response;
  }
  return undefined;
}

test.describe("Rate Limiting", () => {
  test("blocks requests after exceeding the limit, with headers and an error message", async ({
    request,
  }) => {
    test.slow();

    const limited = await requestUntilRateLimited(request);

    expect(limited?.status()).toBe(429);
    const headers = limited?.headers();
    expect(headers?.["x-ratelimit-limit"]).toBe(String(RATE_LIMIT_PER_MINUTE));
    expect(headers?.["x-ratelimit-remaining"]).toBe("0");
    expect(headers?.["x-ratelimit-reset"]).toMatch(/^\d+$/);
    const body: unknown = await limited?.json();
    expect(body).toMatchObject({
      error: expect.stringContaining("Rate limit"),
    });
  });

  test("rate limit resets after the time window", async ({ request }) => {
    test.slow();

    const limited = await requestUntilRateLimited(request);
    expect(limited?.status()).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, WINDOW_RESET_WAIT_MS));

    const response = await request.get(HEALTHCHECK_PATH);
    expect(response.status()).not.toBe(429);
  });

  test("API responses are either successful or rate-limited", async ({
    request,
  }) => {
    for (let i = 0; i < 10; i++) {
      const response = await request.get(HEALTHCHECK_PATH);
      expect([200, 429]).toContain(response.status());
    }
  });

  test("rate limit only applies to /api routes", async ({ request }) => {
    // GET / redirects to /en (307), a normal response that is never rate-limited.
    for (let i = 0; i < 20; i++) {
      const response = await request.get("/");
      expect(response.status()).not.toBe(429);
    }
  });
});
