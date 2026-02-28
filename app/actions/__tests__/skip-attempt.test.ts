import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn().mockImplementation((fn) => fn),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/analytics-server", () => ({
  identifyUser: vi.fn().mockResolvedValue(undefined),
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

import { createAdminClient, createClient } from "@/lib/supabase/server";

import { skipAttempt } from "@/app/actions/game-actions";

const SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const NONCE = "12345";
const USER_ID = "u1b2c3d4-e5f6-7890-abcd-ef1234567892";

function makeSession(attempts_count = 2) {
  return {
    attempts_count,
    challenge_id: "c1b2c3d4-e5f6-7890-abcd-ef1234567891",
    guesses: [],
    id: SESSION_ID,
    last_nonce: NONCE,
    player_id: USER_ID,
    start_time: new Date().toISOString(),
    status: "active",
  };
}

function makeClientMock(session: ReturnType<typeof makeSession>) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: session, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  };
}

function makeAdminMock() {
  return {
    from: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          grace_deadline_at_utc: new Date(Date.now() + 86_400_000).toISOString(),
          perfume_id: "p1",
          xsolve_score: 0.5,
        },
        error: null,
      }),
    }),
  };
}

describe("skipAttempt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active status when attempts remain", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClientMock(makeSession(2)) as ReturnType<typeof makeClientMock>,
    );
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminMock() as ReturnType<typeof makeAdminMock>,
    );

    const result = await skipAttempt(SESSION_ID, NONCE);

    expect(result.gameStatus).toBe("active");
    expect(result.newNonce).toBeDefined();
    expect(result.newNonce).not.toBe(NONCE);
  });

  it("returns lost when last attempt is skipped (attempts_count = 5)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClientMock(makeSession(5)) as ReturnType<typeof makeClientMock>,
    );
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminMock() as ReturnType<typeof makeAdminMock>,
    );

    const result = await skipAttempt(SESSION_ID, NONCE);

    expect(result.gameStatus).toBe("lost");
  });

  it("throws on nonce mismatch", async () => {
    const session = { ...makeSession(), last_nonce: "DIFFERENT" };
    vi.mocked(createClient).mockResolvedValue(
      makeClientMock(session) as ReturnType<typeof makeClientMock>,
    );

    await expect(skipAttempt(SESSION_ID, "WRONG")).rejects.toThrow();
  });

  it("throws on invalid session ID", async () => {
    await expect(skipAttempt("not-a-uuid", NONCE)).rejects.toThrow(
      "Invalid session ID",
    );
  });
});
