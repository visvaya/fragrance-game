import { revalidatePath } from "next/cache";

import * as Sentry from "@sentry/nextjs";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";

import { createAdminClient, createClient } from "@/lib/supabase/server";

import {
  getAnonSessionAttemptCount,
  getSessions,
  migrateAnonymousPlayer,
  revokeSession,
} from "../auth-actions";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extended type for Supabase chain mocks to satisfy ESLint unsafe-return rules */
type SupabaseChainMock = Promise<any> & {
  delete: Mock;
  eq: Mock;
  in: Mock;
  is: Mock;
  limit: Mock;
  maybeSingle: Mock;
  order: Mock;
  select: Mock;
  single: Mock;
  update: Mock;
};

/** Creates a thenable chain — can be awaited directly OR via .single() */
function makeChain(value: unknown): SupabaseChainMock {
  const p = Promise.resolve(value);
  const chain = p as unknown as SupabaseChainMock;

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(value);
  chain.maybeSingle = vi.fn().mockResolvedValue(value);

  // eslint-disable-next-line unicorn/no-thenable -- necessary for Supabase chain mocking
  chain.then = p.then.bind(p);

  return chain;
}

/** Admin auth mock whose getUserById reports the source account's anonymity. */
function makeAdminAuth({ isAnonymous }: { isAnonymous: boolean | null }): {
  admin: { getUserById: Mock };
} {
  return {
    admin: {
      getUserById: vi.fn().mockResolvedValue(
        isAnonymous === null
          ? { data: { user: null }, error: { message: "User not found" } }
          : {
              data: { user: { id: "source", is_anonymous: isAnonymous } },
              error: null,
            },
      ),
    },
  };
}

const MOCK_IP = "127.0.0.1";
const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const VALID_UUID_2 = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ---------------------------------------------------------------------------
// getSessions
// ---------------------------------------------------------------------------

describe("getSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockSessions }),
        select: vi.fn().mockReturnThis(),
      }),
    } as never);

    const result = await getSessions();

    expect(result).toEqual(mockSessions);
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
        order: vi.fn().mockResolvedValue({ data: null }),
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
    await expect(revokeSession("not-a-uuid")).rejects.toThrow();
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

  it("returns RPC error and triggers fallback update when RPC fails", async () => {
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
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: { message: "RPC failed" } }),
    } as never);

    const result = await revokeSession(VALID_UUID);

    expect(result).toEqual({ error: "RPC failed", success: false });
    expect(Sentry.captureException).toHaveBeenCalled();
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
  });
});

// ---------------------------------------------------------------------------
// migrateAnonymousPlayer
// ---------------------------------------------------------------------------

describe("migrateAnonymousPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for non-string input", async () => {
    const result = await migrateAnonymousPlayer(null as any);

    expect(result).toEqual({ error: "Invalid anonymous player ID" });
  });

  it("returns error for a string that is not a UUID", async () => {
    const result = await migrateAnonymousPlayer("not-a-uuid");

    expect(result).toEqual({ error: "Invalid anonymous player ID" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses to migrate from a registered (non-anonymous) account", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-abc" } },
          error: null,
        }),
      },
    } as never);
    const from = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: makeAdminAuth({ isAnonymous: false }),
      from,
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID_2);

    expect(result).toEqual({ error: "Source account is not anonymous" });
    expect(from).not.toHaveBeenCalled();
  });

  it("refuses to migrate when the source account does not exist", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-abc" } },
          error: null,
        }),
      },
    } as never);
    const from = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: makeAdminAuth({ isAnonymous: null }),
      from,
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID_2);

    expect(result).toEqual({ error: "Source account is not anonymous" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns error when user not authenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID);

    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when migrating to same account", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: VALID_UUID } },
          error: null,
        }),
      },
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID);

    expect(result).toEqual({ error: "Cannot migrate to same account" });
  });

  it("returns error when session migration fails", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-abc" } },
          error: null,
        }),
      },
    } as never);

    // Call counter for game_sessions (1st = user sessions read, 2nd = update)
    let gameSessionsCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      auth: makeAdminAuth({ isAnonymous: true }),
      // eslint-disable-next-line @typescript-eslint/promise-function-async -- mocks return thenable chains
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "game_sessions") {
          gameSessionsCount++;
          if (gameSessionsCount === 1) {
            // Read user sessions — returns empty array (no conflicts)
            return makeChain({ data: [], error: null });
          }
          // Update sessions — fails
          return makeChain({
            data: null,
            error: { message: "Session update failed" },
          });
        }
        return makeChain({ data: null, error: null });
      }),
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID_2);

    expect(result).toEqual({ error: "Failed to migrate sessions" });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("returns error when results migration fails", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-abc" } },
          error: null,
        }),
      },
    } as never);

    vi.mocked(createAdminClient).mockReturnValue({
      auth: makeAdminAuth({ isAnonymous: true }),
      // eslint-disable-next-line @typescript-eslint/promise-function-async -- mocks return thenable chains
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "game_sessions") {
          // Both read and update succeed
          return makeChain({ data: [], error: null });
        }
        if (table === "game_results") {
          return makeChain({
            data: null,
            error: { message: "Results update failed" },
          });
        }
        return makeChain({ data: null, error: null });
      }),
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID_2);

    expect(result).toEqual({ error: "Failed to migrate results" });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("returns success when migration completes with no streaks", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-abc" } },
          error: null,
        }),
      },
    } as never);

    vi.mocked(createAdminClient).mockReturnValue({
      auth: makeAdminAuth({ isAnonymous: true }),
      from: vi
        .fn()
        // eslint-disable-next-line @typescript-eslint/promise-function-async -- mocks return thenable chains
        .mockImplementation(() => makeChain({ data: null, error: null })),
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID_2);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("merges streaks when both anon and user streaks exist", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-abc" } },
          error: null,
        }),
      },
    } as never);

    let playerStreaksCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      auth: makeAdminAuth({ isAnonymous: true }),
      // eslint-disable-next-line @typescript-eslint/promise-function-async -- mocks return thenable chains
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "player_streaks") {
          playerStreaksCount++;
          if (playerStreaksCount === 1) {
            // Anon streak
            return makeChain({
              data: {
                best_streak: 5,
                current_streak: 3,
                joker_used_date: null,
                jokers_remaining: 2,
                last_played_date: "2026-03-30",
                player_id: VALID_UUID_2,
                updated_at: "2026-03-30",
              },
            });
          }
          if (playerStreaksCount === 2) {
            // User streak
            return makeChain({
              data: {
                best_streak: 10,
                current_streak: 1,
                joker_used_date: null,
                jokers_remaining: 1,
                last_played_date: "2026-03-29",
                player_id: "user-abc",
                updated_at: "2026-03-29",
              },
            });
          }
          // Update / delete calls
          return makeChain({ data: null, error: null });
        }
        return makeChain({ data: null, error: null });
      }),
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID_2);

    expect(result).toEqual({ success: true });
  });

  it("adopts anon streak when user has no streak", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-abc" } },
          error: null,
        }),
      },
    } as never);

    let playerStreaksCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      auth: makeAdminAuth({ isAnonymous: true }),
      // eslint-disable-next-line @typescript-eslint/promise-function-async -- mocks return thenable chains
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "player_streaks") {
          playerStreaksCount++;
          if (playerStreaksCount === 1) {
            return makeChain({
              data: {
                best_streak: 5,
                current_streak: 3,
                joker_used_date: null,
                jokers_remaining: 2,
                last_played_date: "2026-03-30",
                player_id: VALID_UUID_2,
                updated_at: "2026-03-30",
              },
            });
          }
          // No user streak
          return makeChain({ data: null, error: null });
        }
        return makeChain({ data: null, error: null });
      }),
    } as never);

    const result = await migrateAnonymousPlayer(VALID_UUID_2);

    expect(result).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// getAnonSessionAttemptCount
// ---------------------------------------------------------------------------

describe("getAnonSessionAttemptCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 for non-string input", async () => {
    const result = await getAnonSessionAttemptCount(null as any, VALID_UUID);

    expect(result).toEqual({ attemptCount: 0 });
  });

  it("returns 0 when user not authenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const result = await getAnonSessionAttemptCount(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ attemptCount: 0 });
  });

  it("returns 0 for anonymous user (is_anonymous: true)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", is_anonymous: true } },
        }),
      },
    } as never);

    const result = await getAnonSessionAttemptCount(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ attemptCount: 0 });
  });

  it("returns attempt count from DB for authenticated non-anonymous user", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", is_anonymous: false } },
        }),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { attempts_count: 3 },
        }),
        select: vi.fn().mockReturnThis(),
      }),
    } as never);

    const result = await getAnonSessionAttemptCount(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ attemptCount: 3 });
  });

  it("returns 0 when session not found in DB", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", is_anonymous: false } },
        }),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        select: vi.fn().mockReturnThis(),
      }),
    } as never);

    const result = await getAnonSessionAttemptCount(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ attemptCount: 0 });
  });
});
