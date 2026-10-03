import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn().mockImplementation(<T>(function_: T) => function_),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/analytics-server", () => ({
  identifyUser: vi.fn().mockResolvedValue(undefined),
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

import { skipAttempt } from "@/app/actions/game-actions";
import { MASK_CHAR } from "@/lib/constants";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const NONCE = "12345";
const USER_ID = "u1b2c3d4-e5f6-7890-abcd-ef1234567892";

function makeSession(attemptsCount = 2) {
  return {
    attempts_count: attemptsCount,
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

const ANSWER_ROW = {
  base_notes: ["Vanilla"],
  brands: { name: "Chanel" },
  gender: "Feminine",
  is_linear: false,
  middle_notes: ["Rose"],
  name: "Coco",
  perfumers: ["Jacques Polge"],
  release_year: 2001,
  top_notes: ["Bergamot"],
  xsolve_score: 0.5,
};

function makeAdminMock() {
  return {
    from: vi.fn((table: string) => ({
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data:
          table === "perfumes"
            ? ANSWER_ROW
            : {
                grace_deadline_at_utc: new Date(
                  Date.now() + 86_400_000,
                ).toISOString(),
                perfume_id: "p1",
              },
        error: null,
      }),
    })),
  };
}

describe("skipAttempt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active status when attempts remain", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClientMock(makeSession(2)) as any,
    );

    vi.mocked(createAdminClient).mockReturnValue(makeAdminMock() as any);

    const result = await skipAttempt(SESSION_ID, NONCE);

    expect(result.gameStatus).toBe("active");
    expect(result.newNonce).toBeDefined();
    expect(result.newNonce).not.toBe(NONCE);
  });

  it("returns level-2 clues after skipping attempt 1", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClientMock(makeSession(0)) as any,
    );
    vi.mocked(createAdminClient).mockReturnValue(makeAdminMock() as any);

    const result = await skipAttempt(SESSION_ID, NONCE);

    expect(result.revealed.year).toBe(`2${MASK_CHAR.repeat(3)}`);
    expect(result.revealed.brand).not.toBe("Chanel");
  });

  it("returns fully revealed clues after the final skip", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClientMock(makeSession(5)) as any,
    );
    vi.mocked(createAdminClient).mockReturnValue(makeAdminMock() as any);

    const result = await skipAttempt(SESSION_ID, NONCE);

    expect(result.revealed).toMatchObject({
      brand: "Chanel",
      perfumer: "Jacques Polge",
      year: "2001",
    });
  });

  it("returns lost when last attempt is skipped (attempts_count = 5)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClientMock(makeSession(5)) as any,
    );

    vi.mocked(createAdminClient).mockReturnValue(makeAdminMock() as any);

    const result = await skipAttempt(SESSION_ID, NONCE);

    expect(result.gameStatus).toBe("lost");
  });

  it("fails before saving when the guess history cannot be read", async () => {
    const session = {
      ...makeSession(1),
      guesses: [
        { isCorrect: false, perfumeId: "g1", timestamp: "t" },
      ] as never[],
    };
    const client = makeClientMock(session);
    vi.mocked(createClient).mockResolvedValue(client as any);

    const admin = makeAdminMock();
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        const chain = admin.from(table);
        // The history read is the only query that filters with in(); fail it.
        return {
          ...chain,
          in: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "connection reset" },
            }),
          }),
        };
      }),
    } as any);

    await expect(skipAttempt(SESSION_ID, NONCE)).rejects.toThrow(
      "Guess history unavailable",
    );
    const sessionChain = client.from.mock.results[0]?.value as {
      update: ReturnType<typeof vi.fn>;
    };
    expect(sessionChain.update).not.toHaveBeenCalled();
  });

  it("throws on nonce mismatch", async () => {
    const session = { ...makeSession(), last_nonce: "DIFFERENT" };

    vi.mocked(createClient).mockResolvedValue(makeClientMock(session) as any);

    await expect(skipAttempt(SESSION_ID, "WRONG")).rejects.toThrow();
  });

  it("throws on invalid session ID", async () => {
    await expect(skipAttempt("not-a-uuid", NONCE)).rejects.toThrow(
      "Invalid session ID",
    );
  });
});
