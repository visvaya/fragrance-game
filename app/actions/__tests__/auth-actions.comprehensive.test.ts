import { revalidatePath } from "next/cache";

import * as Sentry from "@sentry/nextjs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ZodError } from "zod";

import { MAX_LISTED_SESSIONS } from "@/lib/constants";
import { checkRateLimit } from "@/lib/redis";
import { createAdminClient, createClient } from "@/lib/supabase/server";

import { getSessions, revokeSession } from "../auth-actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

const MOCK_IP = "127.0.0.1";
const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ---------------------------------------------------------------------------
// getSessions
// ---------------------------------------------------------------------------

describe("getSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts each call against the signed-in user", async () => {
    const from = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
      order: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
      from,
    } as never);

    await getSessions();

    expect(checkRateLimit).toHaveBeenCalledWith("getSessions", "user-123");
  });

  it("rejects without a lookup once the limit is exceeded", async () => {
    const from = vi.fn();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
      from,
    } as never);
    vi.mocked(checkRateLimit).mockRejectedValueOnce(
      new Error("Rate limit exceeded"),
    );

    await expect(getSessions()).rejects.toThrow("Rate limit exceeded");
    expect(from).not.toHaveBeenCalled();
  });

  it("returns empty array when user is not authenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const result = await getSessions();

    expect(result).toEqual([]);
  });

  it("returns sessions for authenticated user", async () => {
    const mockSessions = [
      {
        created_at: "2024-01-01",
        device_info: {},
        id: "sess-1",
        ip_address: MOCK_IP,
        last_active_at: "2024-01-02",
        revoked_at: null,
        user_id: "user-123",
      },
    ];
    const limit = vi.fn().mockResolvedValue({ data: mockSessions });
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit,
        order: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      }),
    } as never);

    const result = await getSessions();

    expect(result).toEqual(mockSessions);
    expect(limit).toHaveBeenCalledWith(MAX_LISTED_SESSIONS);
  });

  it("returns empty array when DB returns null", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null }),
        order: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      }),
    } as never);

    const result = await getSessions();

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// revokeSession
// ---------------------------------------------------------------------------

describe("revokeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws ZodError for invalid UUID sessionId", async () => {
    await expect(revokeSession("not-a-uuid")).rejects.toThrow(ZodError);
  });

  it("returns unauthorized error when user not authenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const result = await revokeSession(VALID_UUID);

    expect(result).toEqual({ error: "Unauthorized", success: false });
  });

  it("returns session-not-found error and calls Sentry when fetch fails", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Not found" },
        }),
      }),
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const result = await revokeSession(VALID_UUID);

    expect(result).toEqual({ error: "Session not found", success: false });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("returns the RPC error and leaves the session row untouched when RPC fails", async () => {
    // Marking the row revoked would hide a session that is still valid.
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { session_token_hash: "hash-xyz" },
          error: null,
        }),
      }),
    } as never);
    const adminFrom = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({
      from: adminFrom,
      rpc: vi.fn().mockResolvedValue({ error: { message: "RPC failed" } }),
    } as never);

    const result = await revokeSession(VALID_UUID);

    expect(result).toEqual({ error: "RPC failed", success: false });
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("returns success and revalidates path when session revoked successfully", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { session_token_hash: "hash-xyz" },
          error: null,
        }),
      }),
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    const result = await revokeSession(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith(
      "/[locale]/auth/sessions",
      "page",
    );
  });
});
