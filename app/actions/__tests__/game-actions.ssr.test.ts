/**
 * Tests for SSR / lazy-init functions in game-actions.ts:
 *   - getDailyChallengeSSR  (unstable_cache wrapped)
 *   - getDailyStep1ImageUrl (unstable_cache wrapped)
 *   - getPlayerDailySession
 *   - initializeAndGuess   (Zod validation + delegation)
 *   - initializeAndSkip    (Zod validation + delegation)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  // unstable_cache returns the function as-is so we can call it directly in tests
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

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_ASSETS_HOST: "assets.test.com",
    NODE_ENV: "test",
  },
}));

import { createAdminClient, createClient } from "@/lib/supabase/server";

import {
  getDailyChallengeSSR,
  getDailyStep1ImageUrl,
  getPlayerDailySession,
  initializeAndGuess,
  initializeAndSkip,
} from "../game-actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Thenable chain that resolves when awaited or when .single() / .maybeSingle() called */
function makeChain(value: unknown) {
  const p = Promise.resolve(value);
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(value);
  chain.maybeSingle = vi.fn().mockResolvedValue(value);
  // eslint-disable-next-line unicorn/no-thenable -- necessary for Supabase chain mocking
  chain.then = p.then.bind(p);
  chain.catch = p.catch.bind(p);
  chain.finally = p.finally.bind(p);
  return chain;
}

const TODAY = new Date().toISOString().split("T")[0];
const VALID_CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_PERFUME_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d471";

// ---------------------------------------------------------------------------
// getDailyChallengeSSR
// ---------------------------------------------------------------------------

describe("getDailyChallengeSSR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when challenge not found (PGRST116)", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeChain({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      ),
    } as never);

    const result = await getDailyChallengeSSR(TODAY);

    expect(result).toBeNull();
  });

  it("returns null on non-PGRST116 error", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi
        .fn()
        .mockReturnValue(
          makeChain({ data: null, error: { code: "500", message: "DB down" } }),
        ),
    } as never);

    const result = await getDailyChallengeSSR(TODAY);

    expect(result).toBeNull();
  });

  it("returns null when data.id is null", async () => {
    let callCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeChain({
            data: { challenge_date: TODAY, id: null },
            error: null,
          });
        }
        return makeChain({ data: null, error: null });
      }),
    } as never);

    const result = await getDailyChallengeSSR(TODAY);

    expect(result).toBeNull();
  });

  it("returns null when challengePrivate not found", async () => {
    let callCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // daily_challenges_public
          return makeChain({
            data: {
              challenge_date: TODAY,
              grace_deadline_at_utc: "2026-04-02T00:00:00Z",
              id: VALID_CHALLENGE_ID,
              mode: "daily",
              snapshot_metadata: {},
            },
            error: null,
          });
        }
        // daily_challenges → no data
        return makeChain({ data: null, error: null });
      }),
    } as never);

    const result = await getDailyChallengeSSR(TODAY);

    expect(result).toBeNull();
  });

  it("returns null when perfume xsolve_score is null", async () => {
    let callCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeChain({
            data: {
              challenge_date: TODAY,
              grace_deadline_at_utc: "2026-04-02T00:00:00Z",
              id: VALID_CHALLENGE_ID,
              mode: "daily",
              snapshot_metadata: {},
            },
            error: null,
          });
        }
        if (callCount === 2) {
          return makeChain({
            data: { perfume_id: VALID_PERFUME_ID },
            error: null,
          });
        }
        // perfumes — xsolve_score is null
        return makeChain({
          data: {
            base_notes: [],
            brands: { name: "Dior" },
            concentrations: { name: "EDP" },
            gender: "Male",
            is_linear: false,
            middle_notes: [],
            perfumers: ["Creator"],
            release_year: 2015,
            top_notes: [],
            xsolve_score: null,
          },
          error: null,
        });
      }),
    } as never);

    const result = await getDailyChallengeSSR(TODAY);

    expect(result).toBeNull();
  });

  it("returns full challenge on success", async () => {
    let callCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeChain({
            data: {
              challenge_date: TODAY,
              grace_deadline_at_utc: "2026-04-02T00:00:00Z",
              id: VALID_CHALLENGE_ID,
              mode: "daily",
              snapshot_metadata: {},
            },
            error: null,
          });
        }
        if (callCount === 2) {
          return makeChain({
            data: { perfume_id: VALID_PERFUME_ID },
            error: null,
          });
        }
        return makeChain({
          data: {
            base_notes: ["Vanilla"],
            brands: { name: "Dior" },
            concentrations: { name: "EDP" },
            gender: "Male",
            is_linear: false,
            middle_notes: ["Rose"],
            perfumers: ["Creator"],
            release_year: 2015,
            top_notes: ["Bergamot"],
            xsolve_score: 80,
          },
          error: null,
        });
      }),
    } as never);

    const result = await getDailyChallengeSSR(TODAY);

    expect(result).not.toBeNull();
    expect(result?.clues.brand).toBe("Dior");
    expect(result?.clues.xsolve).toBe(80);
    expect(result?.clues.notes.top).toContain("Bergamot");
  });
});

// ---------------------------------------------------------------------------
// getDailyStep1ImageUrl
// ---------------------------------------------------------------------------

describe("getDailyStep1ImageUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when challenge not found", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
    } as never);

    const result = await getDailyStep1ImageUrl(TODAY);

    expect(result).toBeNull();
  });

  it("returns null when perfume assets not found", async () => {
    let callCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeChain({
            data: { perfume_id: VALID_PERFUME_ID },
            error: null,
          });
        }
        return makeChain({ data: null, error: null });
      }),
    } as never);

    const result = await getDailyStep1ImageUrl(TODAY);

    expect(result).toBeNull();
  });

  it("returns null when image_key_step_1 is missing", async () => {
    let callCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeChain({
            data: { perfume_id: VALID_PERFUME_ID },
            error: null,
          });
        }
        return makeChain({ data: { image_key_step_1: null }, error: null });
      }),
    } as never);

    const result = await getDailyStep1ImageUrl(TODAY);

    expect(result).toBeNull();
  });

  it("returns full URL with configured assets host on success", async () => {
    let callCount = 0;
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeChain({
            data: { perfume_id: VALID_PERFUME_ID },
            error: null,
          });
        }
        return makeChain({
          data: { image_key_step_1: "perfumes/abc/step1.jpg" },
          error: null,
        });
      }),
    } as never);

    const result = await getDailyStep1ImageUrl(TODAY);

    expect(result).toBe("https://assets.test.com/perfumes/abc/step1.jpg");
  });

  it("returns null on unexpected exception (graceful fallback)", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        throw new Error("Unexpected failure");
      }),
    } as never);

    const result = await getDailyStep1ImageUrl(TODAY);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getPlayerDailySession
// ---------------------------------------------------------------------------

describe("getPlayerDailySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws ZodError for invalid challengeId UUID", async () => {
    await expect(getPlayerDailySession("not-a-uuid")).rejects.toThrow();
  });

  it("returns null for unauthenticated user", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const result = await getPlayerDailySession(VALID_CHALLENGE_ID);

    expect(result).toBeNull();
  });

  it("returns null when startGame throws an error (graceful fallback)", async () => {
    vi.mocked(createClient).mockRejectedValue(
      new Error("Supabase unavailable"),
    );

    const result = await getPlayerDailySession(VALID_CHALLENGE_ID);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// initializeAndGuess / initializeAndSkip — input validation
// ---------------------------------------------------------------------------

describe("initializeAndGuess — Zod validation", () => {
  it("throws ZodError for invalid challengeId", async () => {
    await expect(
      initializeAndGuess("not-uuid", VALID_PERFUME_ID, 0),
    ).rejects.toThrow();
  });

  it("throws ZodError for invalid perfumeId", async () => {
    await expect(
      initializeAndGuess(VALID_CHALLENGE_ID, "not-uuid", 0),
    ).rejects.toThrow();
  });

  it("throws ZodError for negative inheritedCount", async () => {
    await expect(
      initializeAndGuess(VALID_CHALLENGE_ID, VALID_PERFUME_ID, -1),
    ).rejects.toThrow();
  });
});

describe("initializeAndSkip — Zod validation", () => {
  it("throws ZodError for invalid challengeId", async () => {
    await expect(initializeAndSkip("not-uuid", 0)).rejects.toThrow();
  });

  it("throws ZodError for negative inheritedCount", async () => {
    await expect(initializeAndSkip(VALID_CHALLENGE_ID, -1)).rejects.toThrow();
  });
});
