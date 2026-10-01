/**
 * Tests for the debug-only resetGame server action. Players have no DELETE
 * rights on game_sessions / game_results, so the reset must delete with the
 * service role while staying scoped to the signed-in player.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn().mockImplementation((function_: unknown) => function_),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/analytics-server", () => ({
  identifyUser: vi.fn(),
  trackEvent: vi.fn(),
}));

const envMock = vi.hoisted(() => {
  const env: {
    NEXT_PUBLIC_ASSETS_HOST: string;
    NEXT_PUBLIC_GAME_RESET_ENABLED: string | undefined;
    NODE_ENV: string;
  } = {
    NEXT_PUBLIC_ASSETS_HOST: "assets.test.com",
    NEXT_PUBLIC_GAME_RESET_ENABLED: "true",
    NODE_ENV: "test",
  };
  return { env };
});

vi.mock("@/lib/env", () => envMock);

import { createAdminClient, createClient } from "@/lib/supabase/server";

import { resetGame } from "../game-actions";

const SESSION_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const USER_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const CHALLENGE_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

type DeleteChain = {
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
};

/** Delete chain recording the filters applied before it is awaited. */
function makeDeleteChain(): DeleteChain {
  const chain = {} as DeleteChain;
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  return chain;
}

/** User client: authenticated user whose own session row points at CHALLENGE_ID. */
function mockUserClient(userFrom: ReturnType<typeof vi.fn>): void {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from: userFrom,
  } as never);
}

describe("resetGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.env.NEXT_PUBLIC_GAME_RESET_ENABLED = "true";
  });

  it("is disabled unless the reset flag is set", async () => {
    envMock.env.NEXT_PUBLIC_GAME_RESET_ENABLED = undefined;

    const result = await resetGame(SESSION_ID);

    expect(result).toEqual({ error: "Reset disabled", success: false });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("deletes the caller's rows with the service role", async () => {
    const sessionLookup = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: { challenge_id: CHALLENGE_ID } }),
    };
    const userFrom = vi.fn().mockReturnValue(sessionLookup);
    mockUserClient(userFrom);

    const results = makeDeleteChain();
    const sessions = makeDeleteChain();
    const adminFrom = vi
      .fn()
      .mockImplementation((table: string) =>
        table === "game_results" ? results : sessions,
      );
    vi.mocked(createAdminClient).mockReturnValue({ from: adminFrom } as never);

    const result = await resetGame(SESSION_ID);

    expect(result).toEqual({ success: true });
    expect(adminFrom).toHaveBeenCalledWith("game_results");
    expect(adminFrom).toHaveBeenCalledWith("game_sessions");
    for (const chain of [results, sessions]) {
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith("player_id", USER_ID);
      expect(chain.eq).toHaveBeenCalledWith("challenge_id", CHALLENGE_ID);
    }
    expect(userFrom).not.toHaveBeenCalledWith("game_results");
  });
});
