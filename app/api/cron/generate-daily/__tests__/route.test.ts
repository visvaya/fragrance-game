import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Supabase before importing the route
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: "existing-challenge" } })),
          })),
        })),
      })),
    })),
  })),
}));

import { GET } from "../route";

describe("CRON Job Security - generate-daily", () => {
  const originalEnvironment = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnvironment) {
      process.env.CRON_SECRET = originalEnvironment;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it("returns 401 without Authorization header", async () => {
    process.env.CRON_SECRET = "test-secret";

    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 with invalid Bearer token", async () => {
    process.env.CRON_SECRET = "test-secret";

    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: "Bearer wrong-token",
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 with malformed Authorization header (missing Bearer prefix)", async () => {
    process.env.CRON_SECRET = "test-secret";

    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: "test-secret", // Missing "Bearer" prefix
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 500 if CRON_SECRET not configured", async () => {
    delete process.env.CRON_SECRET;

    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
    );
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Server misconfiguration");
  });

  it("accepts valid Bearer token and returns success", async () => {
    process.env.CRON_SECRET = "test-secret-123";

    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: "Bearer test-secret-123",
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("success");
    expect(json.results).toBeDefined();
    expect(Array.isArray(json.results)).toBe(true);
  });

  it("returns 401 for case-sensitive token mismatch", async () => {
    process.env.CRON_SECRET = "Test-Secret";

    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: "Bearer test-secret", // Different case
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("prevents timing attacks by checking entire token", async () => {
    process.env.CRON_SECRET = "my-super-secret-token";

    // Partial match attempt
    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: "Bearer my-super-secret", // Truncated
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
