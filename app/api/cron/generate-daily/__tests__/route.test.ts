import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env before importing the route — env.CRON_SECRET is frozen at import time
// so process.env mutations have no effect after module initialization.
vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "test-cron-secret",
  },
}));

// Mock next/cache: revalidateTag is not available in test environment
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

// Mock Supabase before importing the route
vi.mock("@/lib/supabase/server", () => {
  const mockSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: "existing-challenge" } });
  const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

  return {
    createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
  };
});

import { GET } from "../route";

describe("CRON Job Security - generate-daily", () => {
  const TEST_SECRET = "test-cron-secret";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 with invalid Bearer token", async () => {
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
    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: TEST_SECRET, // Missing "Bearer" prefix
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  // NOTE: "returns 500 if CRON_SECRET not configured" is no longer testable here.
  // env.CRON_SECRET is validated at startup via Zod — missing secret causes the
  // app to fail to start, not return 500 at request time.

  it("accepts valid Bearer token and returns success", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: `Bearer ${TEST_SECRET}`,
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
    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: `Bearer ${TEST_SECRET.toUpperCase()}`, // Different case
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("prevents timing attacks by checking entire token", async () => {
    // Partial match attempt
    const request = new NextRequest(
      "http://localhost:3000/api/cron/generate-daily",
      {
        headers: {
          Authorization: `Bearer ${TEST_SECRET.slice(0, -4)}`, // Truncated
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
