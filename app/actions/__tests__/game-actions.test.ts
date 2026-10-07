import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn().mockImplementation((function_: unknown) => function_),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/guest-ticket-cookie", () => ({
  issueGuestTicket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/analytics-server", () => ({
  identifyUser: vi.fn(),
  trackEvent: vi.fn(),
}));

// Import after mocks
import { MASK_CHAR } from "@/lib/constants";
import { createClient, createAdminClient } from "@/lib/supabase/server";

import { createMockChallenge, createMockPerfume } from "../../../vitest.setup";
import {
  getDailyChallenge,
  initializeGame,
  startGame,
  submitGuess,
} from "../game-actions";

// Helper to create comprehensive Supabase mock that handles all table operations
function createComprehensiveSupabaseMock(config: {
  dailyChallenges?: Record<string, unknown>;
  gameResults?: { shouldFail?: boolean };
  gameSessions?: Record<string, unknown>;
  perfumeAssets?: Record<string, unknown>[];
  perfumes?: Record<string, unknown>[];
  user?: { id: string } | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: config.user ?? { id: "test-user" } },
        error: config.user === null ? { message: "Not authenticated" } : null,
      }),
    },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      };

      switch (table) {
        case "game_sessions": {
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: config.gameSessions ?? null,
            error: null,
          });
          chain.single = vi.fn().mockResolvedValue({
            data: config.gameSessions ?? null,
            error: config.gameSessions ? null : { message: "Not found" },
          });
          chain.insert = vi.fn().mockReturnThis();

          break;
        }
        case "daily_challenges_public": {
          chain.single = vi.fn().mockResolvedValue({
            data: config.dailyChallenges ?? null,
            error: null,
          });

          break;
        }
        case "perfume_assets": {
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: config.perfumeAssets?.[0] ?? null,
            error: null,
          });
          chain.single = vi.fn().mockResolvedValue({
            data: config.perfumeAssets?.[0] ?? null,
            error: config.perfumeAssets?.[0] ? null : { message: "Not found" },
          });

          break;
        }
        case "game_results": {
          chain.insert = vi.fn().mockResolvedValue({
            data: config.gameResults?.shouldFail ? null : { id: "result-123" },
            error: config.gameResults?.shouldFail
              ? { message: "Insert failed" }
              : null,
          });

          break;
        }
        // No default
      }

      return chain;
    }),
  };
}

// Helper to create admin client mock with complete method chains
function createAdminClientMock(config: {
  dailyChallenges?: Record<string, unknown>;
  perfumeAssets?: Record<string, unknown> | null;
  perfumers?: Record<string, unknown>[];
  perfumes?: Record<string, unknown> | null;
}) {
  return {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "Not found" } }),
      };

      switch (table) {
        case "daily_challenges": {
          chain.single = vi.fn().mockResolvedValue({
            data: config.dailyChallenges ?? null,
            error: config.dailyChallenges ? null : { message: "Not found" },
          });
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: config.dailyChallenges ?? null,
            error: null,
          });

          break;
        }
        case "perfumes": {
          chain.single = vi.fn().mockResolvedValue({
            data: config.perfumes ?? null,
            error: config.perfumes ? null : { message: "Not found" },
          });

          break;
        }
        case "perfume_assets": {
          chain.single = vi.fn().mockResolvedValue({
            data: config.perfumeAssets ?? null,
            error: config.perfumeAssets ? null : { message: "Not found" },
          });
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: config.perfumeAssets ?? null,
            error: null,
          });

          break;
        }
        case "perfumers": {
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: config.perfumers?.[0] ?? null,
            error: null,
          });

          break;
        }
        // No default
      }

      return chain;
    }),
  };
}

/**
 * Server actions read daily_challenges_public through the service-role client
 * (createAdminClient), because the view is security_invoker and anon/authenticated
 * have no SELECT on the underlying daily_challenges table. This helper layers a
 * "daily_challenges_public" branch onto an existing admin client mock without
 * disturbing the rest of its table handling.
 */
function withPublicView<T extends { from: (table: string) => unknown }>(
  admin: T,
  view: unknown,
): T {
  return {
    ...admin,
    from: vi.fn((table: string) =>
      table === "daily_challenges_public" ? view : admin.from(table),
    ),
  };
}

/**
 * Routes the game state writes (game_sessions and game_results) of an admin client
 * mock to dedicated chains: server actions write game state only with the service
 * role. The session chain resolves `.single()` to `session`.
 */
function withGameWrites<T extends { from: (table: string) => unknown }>(
  admin: T,
  session: { data: unknown; error: unknown },
) {
  const sessionChain = {
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(session),
    update: vi.fn().mockReturnThis(),
  };
  const resultChain = {
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    ...admin,
    from: vi.fn((table: string) => {
      if (table === "game_sessions") return sessionChain;
      if (table === "game_results") return resultChain;
      return admin.from(table);
    }),
    resultChain,
    sessionChain,
  };
}

/**
 * Builds the mock chain for the daily_challenges_public view queries used by
 * getDailyChallenge()/getDailyChallengeSSR()/startGame(): select().eq().limit().single(),
 * and select().eq().maybeSingle() for the availability check before a new session.
 */
function createPublicViewChain(
  data: Record<string, unknown> | null,
  error: unknown = null,
) {
  return {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe("game-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getDailyChallenge Tests ====================

  describe("getDailyChallenge", () => {
    describe("success cases", () => {
      it("returns daily challenge with level-1 revealed clues", async () => {
        const mockChallenge = createMockChallenge();
        const mockPerfume = createMockPerfume();

        const mockSupabaseClient = {
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: null }, error: null }),
          },
        };

        const mockAdminClientBase = {
          from: vi.fn((table: string) => {
            const chain = {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn(),
            };

            if (table === "daily_challenges") {
              chain.single.mockResolvedValue({
                data: { perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
                error: null,
              });
            } else if (table === "perfumes") {
              chain.single.mockResolvedValue({
                data: {
                  base_notes: mockPerfume.notes_base,
                  brands: { name: mockPerfume.brand },
                  concentrations: { name: mockPerfume.concentration },
                  gender: mockPerfume.gender,
                  is_linear: false,
                  middle_notes: mockPerfume.notes_heart,
                  name: mockPerfume.name,
                  perfumers: [mockPerfume.perfumer],
                  release_year: mockPerfume.year,
                  top_notes: mockPerfume.notes_top,
                  xsolve_score: 100,
                },
                error: null,
              });
            }

            return chain;
          }),
        };

        const mockAdminClient = withPublicView(
          mockAdminClientBase,
          createPublicViewChain({
            challenge_date: mockChallenge.challenge_date,
            grace_deadline_at_utc: mockChallenge.grace_deadline_at_utc,
            id: mockChallenge.id,
            mode: mockChallenge.mode,
            snapshot_metadata: mockChallenge.snapshot_metadata,
          }),
        );

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        const result = await getDailyChallenge();

        expect(result).not.toBeNull();
        expect(result).not.toHaveProperty("clues");
        expect(result?.revealed).toHaveProperty("brand");
        expect(result?.revealed).toHaveProperty("perfumer");
        expect(result?.revealed).toHaveProperty("year");
        expect(result?.revealed).toHaveProperty("notes");
        expect(result?.revealed.brandRevealed).toBe(false);
      });

      it("handles perfumes with multiple perfumers", async () => {
        const mockChallenge = createMockChallenge();

        const mockSupabaseClient = {
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: null }, error: null }),
          },
        };

        const mockAdminClientBase = {
          from: vi.fn((table: string) => {
            const chain = {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn(),
            };

            if (table === "daily_challenges") {
              chain.single.mockResolvedValue({
                data: { perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
                error: null,
              });
            } else if (table === "perfumes") {
              chain.single.mockResolvedValue({
                data: {
                  base_notes: ["Musk"],
                  brands: { name: "Hermès" },
                  concentrations: { name: "Eau de Toilette" },
                  gender: "Unisex",
                  is_linear: false,
                  middle_notes: ["Rose"],
                  name: "Test Perfume",
                  perfumers: ["Jean-Claude Ellena", "Jacques Cavallier"],
                  release_year: 2000,
                  top_notes: ["Bergamot"],
                  xsolve_score: 100,
                },
                error: null,
              });
            }

            return chain;
          }),
        };

        const mockAdminClient = withPublicView(
          mockAdminClientBase,
          createPublicViewChain({
            challenge_date: mockChallenge.challenge_date,
            grace_deadline_at_utc: mockChallenge.grace_deadline_at_utc,
            id: mockChallenge.id,
            mode: mockChallenge.mode,
            snapshot_metadata: mockChallenge.snapshot_metadata,
          }),
        );

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        const result = await getDailyChallenge();

        expect(result?.revealed.perfumerCount).toBe(2);
        expect(JSON.stringify(result)).not.toMatch(/Ellena|Cavallier/);
      });

      it("uses today's date for challenge lookup", async () => {
        const mockChallenge = createMockChallenge();
        const todayDate = new Date().toISOString().split("T")[0];

        const mockSupabaseClient = {
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: null }, error: null }),
          },
        };

        const mockAdminClientBase = {
          from: vi.fn((table: string) => {
            const chain = {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn(),
            };

            if (table === "daily_challenges") {
              chain.single.mockResolvedValue({
                data: { perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
                error: null,
              });
            } else if (table === "perfumes") {
              chain.single.mockResolvedValue({
                data: {
                  base_notes: [],
                  brands: { name: "Test" },
                  concentrations: { name: "EDP" },
                  gender: "Unisex",
                  is_linear: false,
                  middle_notes: [],
                  name: "Test",
                  perfumers: ["Test"],
                  release_year: 2000,
                  top_notes: [],
                  xsolve_score: 100,
                },
                error: null,
              });
            }

            return chain;
          }),
        };

        const publicViewChain = createPublicViewChain({
          challenge_date: todayDate,
          grace_deadline_at_utc: mockChallenge.grace_deadline_at_utc,
          id: mockChallenge.id,
          mode: mockChallenge.mode,
          snapshot_metadata: mockChallenge.snapshot_metadata,
        });
        const mockAdminClient = withPublicView(
          mockAdminClientBase,
          publicViewChain,
        );

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        await getDailyChallenge();

        // getDailyChallenge() now reads daily_challenges_public through the
        // service-role client (createAdminClient), not the user-scoped client.
        expect(publicViewChain.eq).toHaveBeenCalledWith(
          "challenge_date",
          todayDate,
        );
      });
    });

    describe("error cases", () => {
      it("returns null when no challenge exists for today", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: null }, error: null }),
          },
        };
        const mockAdminClient = withPublicView(
          { from: vi.fn() },
          createPublicViewChain(null, {
            code: "PGRST116",
            message: "No rows found",
          }),
        );

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        const result = await getDailyChallenge();

        expect(result).toBeNull();
      });

      it("throws error when database query fails", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: null }, error: null }),
          },
        };
        const mockAdminClient = withPublicView(
          { from: vi.fn() },
          createPublicViewChain(null, {
            code: "DB_ERROR",
            message: "Database connection failed",
          }),
        );

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        await expect(getDailyChallenge()).rejects.toThrow(
          "Failed to fetch daily challenge",
        );
      });

      it("throws error when perfume is missing xsolve_score", async () => {
        const mockChallenge = createMockChallenge();

        const mockSupabaseClient = {
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: null }, error: null }),
          },
        };

        const mockAdminClientBase = {
          from: vi.fn((table: string) => {
            const chain = {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn(),
            };

            if (table === "daily_challenges") {
              chain.single.mockResolvedValue({
                data: { perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
                error: null,
              });
            } else if (table === "perfumes") {
              chain.single.mockResolvedValue({
                data: {
                  base_notes: [],
                  brands: { name: "Test" },
                  concentrations: { name: "EDP" },
                  gender: "Unisex",
                  is_linear: false,
                  middle_notes: [],
                  name: "Invalid Perfume",
                  perfumers: [],
                  release_year: 2000,
                  top_notes: [],
                  xsolve_score: null, // Missing!
                },
                error: null,
              });
            }

            return chain;
          }),
        };

        const mockAdminClient = withPublicView(
          mockAdminClientBase,
          createPublicViewChain({
            challenge_date: mockChallenge.challenge_date,
            grace_deadline_at_utc: mockChallenge.grace_deadline_at_utc,
            id: mockChallenge.id,
            mode: mockChallenge.mode,
            snapshot_metadata: mockChallenge.snapshot_metadata,
          }),
        );

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        await expect(getDailyChallenge()).rejects.toThrow(
          "has no xsolve_score",
        );
      });

      it("throws error when perfume not found", async () => {
        const mockChallenge = createMockChallenge();

        const mockSupabaseClient = {
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: null }, error: null }),
          },
        };

        const mockAdminClientBase = {
          from: vi.fn((table: string) => {
            const chain = {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn(),
            };

            if (table === "daily_challenges") {
              chain.single.mockResolvedValue({
                data: { perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
                error: null,
              });
            } else if (table === "perfumes") {
              chain.single.mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              });
            }

            return chain;
          }),
        };

        const mockAdminClient = withPublicView(
          mockAdminClientBase,
          createPublicViewChain({
            challenge_date: mockChallenge.challenge_date,
            grace_deadline_at_utc: mockChallenge.grace_deadline_at_utc,
            id: mockChallenge.id,
            mode: mockChallenge.mode,
            snapshot_metadata: mockChallenge.snapshot_metadata,
          }),
        );

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        await expect(getDailyChallenge()).rejects.toThrow(
          "Perfume not found for challenge",
        );
      });
    });

    describe("data integrity", () => {
      it("provides fallback values for optional fields", async () => {
        const mockChallenge = createMockChallenge();

        const mockSupabaseClient = {
          auth: {
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: null }, error: null }),
          },
        };

        const mockAdminClientBase = {
          from: vi.fn((table: string) => {
            const chain = {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn(),
            };

            if (table === "daily_challenges") {
              chain.single.mockResolvedValue({
                data: { perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
                error: null,
              });
            } else if (table === "perfumes") {
              chain.single.mockResolvedValue({
                data: {
                  base_notes: null,
                  brands: null,
                  concentrations: null,
                  gender: null,
                  is_linear: null,
                  middle_notes: null,
                  name: "Minimal Perfume",
                  perfumers: null,
                  release_year: null,
                  top_notes: null,
                  xsolve_score: 50,
                },
                error: null,
              });
            }

            return chain;
          }),
        };

        const mockAdminClient = withPublicView(
          mockAdminClientBase,
          createPublicViewChain({
            challenge_date: mockChallenge.challenge_date,
            grace_deadline_at_utc: mockChallenge.grace_deadline_at_utc,
            id: mockChallenge.id,
            mode: mockChallenge.mode,
            snapshot_metadata: mockChallenge.snapshot_metadata,
          }),
        );

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        const result = await getDailyChallenge();

        expect(result?.revealed.answerHas).toEqual({
          brand: false,
          gender: false,
          notes: false,
          perfumer: false,
          year: false,
        });
        expect(result?.revealed.perfumerCount).toBe(0);
      });
    });
  });

  // ==================== startGame Tests ====================

  describe("startGame", () => {
    const mockChallengeId = "550e8400-e29b-41d4-a716-446655440000";
    const mockUserId = "user-test-456";

    describe("new session creation", () => {
      it("creates new game session for authenticated user", async () => {
        const mockNonce = "test-nonce-123";

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockUserId } },
              error: null,
            }),
          },
          from: vi.fn((table: string) => {
            if (table === "game_sessions") {
              return {
                eq: vi.fn().mockReturnThis(),
                insert: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                order: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: {
                    attempts_count: 0,
                    challenge_id: mockChallengeId,
                    id: "123e4567-e89b-12d3-a456-426614174000",
                    last_nonce: mockNonce,
                    player_id: mockUserId,
                    start_time: new Date().toISOString(),
                    status: "active",
                  },
                  error: null,
                }),
              };
            } else if (table === "daily_challenges_public") {
              return {
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: {
                    grace_deadline_at_utc: "2026-02-13T00:00:00Z",
                    mode: "daily",
                  },
                  error: null,
                }),
              };
            }
            return {};
          }),
        };

        // Mock admin client for getImageUrlForStep
        const mockAdminClient = createAdminClientMock({
          dailyChallenges: {
            challenge_date: "2026-02-12",
            perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          },
          perfumeAssets: {
            image_key_step_1: "step1.jpg",
            image_key_step_2: "step2.jpg",
            image_key_step_3: "step3.jpg",
            image_key_step_4: "step4.jpg",
            image_key_step_5: "step5.jpg",
            image_key_step_6: "step6.jpg",
          },
          perfumes: createMockPerfume(),
        });

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        vi.mocked(createAdminClient).mockReturnValue(
          withGameWrites(
            withPublicView(
              mockAdminClient,
              createPublicViewChain({
                challenge_date: "2026-02-12",
                grace_deadline_at_utc: "2026-02-13T00:00:00Z",
                mode: "daily",
              }),
            ),
            {
              data: {
                attempts_count: 0,
                id: "123e4567-e89b-12d3-a456-426614174000",
                last_nonce: mockNonce,
                status: "active",
              },
              error: null,
            },
          ) as never,
        );

        const result = await startGame(mockChallengeId);

        expect(result).toHaveProperty("sessionId");
        expect(result).toHaveProperty("nonce");
        expect(result.guesses).toEqual([]);
        expect(result.revealState).toBeDefined();
      });

      it("throws error when user not authenticated", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: { message: "Not authenticated" },
            }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await expect(startGame(mockChallengeId)).rejects.toThrow(
          "Unauthorized",
        );
      });

      it("throws error when session creation fails", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockUserId } },
              error: null,
            }),
          },
          from: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            order: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Insert failed" },
            }),
          })),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(createAdminClient).mockReturnValue(
          withGameWrites(
            createAdminClientMock({
              dailyChallenges: { challenge_date: "2026-02-12" },
            }),
            { data: null, error: { message: "Insert failed" } },
          ) as never,
        );

        await expect(startGame(mockChallengeId)).rejects.toThrow(
          "Failed to create session",
        );
      });
    });

    describe("existing session resume", () => {
      it("resumes existing active session", async () => {
        const existingSessionData = {
          attempts_count: 2,
          challenge_id: mockChallengeId,
          guesses: [
            {
              feedback: {
                brandMatch: false,
                notesMatch: 0.2,
                perfumerMatch: "none" as const,
                yearDirection: "higher" as const,
                yearMatch: "wrong" as const,
              },
              isCorrect: false,
              perfumeId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
              timestamp: "2026-02-12T10:00:00Z",
            },
          ],
          id: "123e4567-e89b-12d3-a456-426614174000",
          last_nonce: "existing-nonce-456",
          player_id: mockUserId,
          status: "active",
        };

        // First createClient call for startGame
        const mockSupabaseClient1 = createComprehensiveSupabaseMock({
          dailyChallenges: { grace_deadline_at_utc: "2026-02-13T00:00:00Z" },
          gameSessions: existingSessionData,
          user: { id: mockUserId },
        });

        // Second createClient call for getImageUrlForStep
        const mockSupabaseClient2 = createComprehensiveSupabaseMock({
          gameSessions: existingSessionData,
          perfumeAssets: [{ image_url: "https://example.com/perfume.jpg" }],
          user: { id: mockUserId },
        });

        const mockAdminClient = {
          from: vi.fn((table: string) => {
            const chain: Record<string, unknown> = {
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
              order: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            };

            switch (table) {
              case "perfumes": {
                chain.single = vi.fn().mockResolvedValue({
                  data: createMockPerfume(),
                  error: null,
                });
                // For enriching guesses: .in(...).limit(n)
                chain.in = vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        brands: { name: "Test Brand" },
                        concentrations: { name: "EDP" },
                        gender: "Unisex",
                        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                        name: "Test Perfume",
                        release_year: 2020,
                      },
                    ],
                    error: null,
                  }),
                });

                break;
              }
              case "daily_challenges": {
                chain.single = vi.fn().mockResolvedValue({
                  data: {
                    challenge_date: "2026-02-12",
                    perfume_id: "answer-perfume",
                  },
                  error: null,
                });

                break;
              }
              case "perfume_assets": {
                chain.single = vi.fn().mockResolvedValue({
                  data: {
                    image_key_step_1: "step1.jpg",
                    image_key_step_2: "step2.jpg",
                    image_key_step_3: "step3.jpg",
                    image_key_step_4: "step4.jpg",
                    image_key_step_5: "step5.jpg",
                    image_key_step_6: "step6.jpg",
                  },
                  error: null,
                });

                break;
              }
              // No default
            }

            return chain;
          }),
        };

        vi.mocked(createClient)
          .mockResolvedValueOnce(mockSupabaseClient1 as never)
          .mockResolvedValueOnce(mockSupabaseClient2 as never);

        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        const result = await startGame(mockChallengeId);

        expect(result.sessionId).toBe("123e4567-e89b-12d3-a456-426614174000");
        expect(result.nonce).toBe("existing-nonce-456");
        // Verify revealState matches attempt 3 (attempts_count + 1)
        expect(result.revealState.brandLetters).toBe(15);
        expect(result.revealState.perfumerLetters).toBe(10);
        expect(result.revealState.notes).toBe(1);
        expect(result.revealState.radialMask).toBe(8);
        expect(result.revealState.yearMask).toBe("19⎵⎵");
        expect(result.guesses).toBeDefined();
      });

      it("reveals answer for won session", async () => {
        const wonSessionData = {
          attempts_count: 3,
          challenge_id: mockChallengeId,
          guesses: [],
          id: "123e4567-e89b-12d3-a456-426614174000",
          last_nonce: "won-nonce",
          player_id: mockUserId,
          status: "won",
        };

        // First createClient call for startGame
        const mockSupabaseClient1 = createComprehensiveSupabaseMock({
          dailyChallenges: { grace_deadline_at_utc: "2026-02-13T00:00:00Z" },
          gameSessions: wonSessionData,
          user: { id: mockUserId },
        });

        // Second createClient call for getImageUrlForStep
        const mockSupabaseClient2 = createComprehensiveSupabaseMock({
          gameSessions: wonSessionData,
          perfumeAssets: [{ image_url: "https://example.com/perfume.jpg" }],
          user: { id: mockUserId },
        });

        const mockAdminClient = {
          from: vi.fn((table: string) => {
            const chain: Record<string, unknown> = {
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
              order: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            };

            switch (table) {
              case "daily_challenges": {
                chain.single = vi.fn().mockResolvedValue({
                  data: {
                    challenge_date: "2026-02-12",
                    perfume_id: "answer-f47ac10b-58cc-4372-a567-0e02b2c3d479",
                  },
                  error: null,
                });

                break;
              }
              case "perfumes": {
                // First call for answer in startGame
                chain.single = vi.fn().mockResolvedValueOnce({
                  data: {
                    concentrations: { name: "Parfum" },
                    name: "Answer Perfume",
                  },
                  error: null,
                });

                break;
              }
              case "perfume_assets": {
                chain.single = vi.fn().mockResolvedValue({
                  data: {
                    image_key_step_1: "step1.jpg",
                    image_key_step_2: "step2.jpg",
                    image_key_step_3: "step3.jpg",
                    image_key_step_4: "step4.jpg",
                    image_key_step_5: "step5.jpg",
                    image_key_step_6: "step6.jpg",
                  },
                  error: null,
                });

                break;
              }
              // No default
            }

            return chain;
          }),
        };

        vi.mocked(createClient)
          .mockResolvedValueOnce(mockSupabaseClient1 as never)
          .mockResolvedValueOnce(mockSupabaseClient2 as never);

        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        const result = await startGame(mockChallengeId);

        expect(result.answerName).toBe("Answer Perfume");
        expect(result.answerConcentration).toBe("Parfum");
      });
    });
  });

  // ==================== initializeGame Tests ====================

  describe("initializeGame", () => {
    it("returns challenge and session for authenticated user", async () => {
      const todayDate = new Date().toISOString().split("T")[0];
      const mockChallenge = createMockChallenge({ challenge_date: todayDate });

      // Mock getDailyChallenge (user client is only used for auth here)
      const mockSupabaseClientForChallenge = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: null }, error: null }),
        },
      };

      const mockAdminClientBase = {
        from: vi.fn((table: string) => {
          const chain = {
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn(),
          };

          switch (table) {
            case "daily_challenges": {
              chain.single.mockResolvedValue({
                data: { perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
                error: null,
              });
              chain.maybeSingle.mockResolvedValue({
                data: { challenge_date: "2026-02-12" },
                error: null,
              });

              break;
            }
            case "perfumes": {
              chain.single.mockResolvedValue({
                data: {
                  base_notes: ["Musk"],
                  brands: { name: "Test Brand" },
                  concentrations: { name: "EDP" },
                  gender: "Unisex",
                  is_linear: false,
                  middle_notes: ["Rose"],
                  name: "Test Perfume",
                  perfumers: ["Test Perfumer"],
                  release_year: 2020,
                  top_notes: ["Bergamot"],
                  xsolve_score: 100,
                },
                error: null,
              });

              break;
            }
            case "perfume_assets": {
              chain.single.mockResolvedValue({
                data: {
                  image_key_step_1: "step1.jpg",
                  image_key_step_2: "step2.jpg",
                  image_key_step_3: "step3.jpg",
                  image_key_step_4: "step4.jpg",
                  image_key_step_5: "step5.jpg",
                  image_key_step_6: "step6.jpg",
                },
                error: null,
              });

              break;
            }
            // No default
          }

          return chain;
        }),
      };

      const mockAdminClient = withPublicView(
        mockAdminClientBase,
        createPublicViewChain({
          challenge_date: mockChallenge.challenge_date,
          grace_deadline_at_utc: mockChallenge.grace_deadline_at_utc,
          id: mockChallenge.id,
          mode: mockChallenge.mode,
          snapshot_metadata: mockChallenge.snapshot_metadata,
        }),
      );

      // Mock startGame (game_sessions only; daily_challenges_public now comes
      // from the admin client mock above via createNewGameSession)
      const mockSupabaseClientForStart = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "game_sessions") {
            return {
              eq: vi.fn().mockReturnThis(),
              insert: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              order: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  attempts_count: 0,
                  challenge_id: mockChallenge.id,
                  id: "123e4567-e89b-12d3-a456-426614174000",
                  last_nonce: "nonce-123",
                  player_id: "user-123",
                  start_time: new Date().toISOString(),
                  status: "active",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      // Mock getImageUrlForStep
      const mockSupabaseClientForImage = createComprehensiveSupabaseMock({
        gameSessions: {
          attempts_count: 0,
          challenge_id: mockChallenge.id,
          id: "123e4567-e89b-12d3-a456-426614174000",
          player_id: "user-123",
          status: "active",
        },
        perfumeAssets: [
          {
            image_url:
              "https://example.com/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg",
          },
        ],
        user: { id: "user-123" },
      });

      // First call for getDailyChallenge, second for startGame, third for getImageUrlForStep
      vi.mocked(createClient)
        .mockResolvedValueOnce(mockSupabaseClientForChallenge as never)
        .mockResolvedValueOnce(mockSupabaseClientForStart as never)
        .mockResolvedValueOnce(mockSupabaseClientForImage as never);

      vi.mocked(createAdminClient).mockReturnValue(
        withGameWrites(mockAdminClient, {
          data: {
            attempts_count: 0,
            challenge_id: mockChallenge.id,
            id: "123e4567-e89b-12d3-a456-426614174000",
            last_nonce: "nonce-123",
            status: "active",
          },
          error: null,
        }) as never,
      );

      const result = await initializeGame();

      expect(result.challenge).not.toBeNull();
      expect(result.session).not.toBeNull();
      expect(result.challenge?.id).toBe(mockChallenge.id);
      expect(result.session?.sessionId).toBeDefined();
    });

    it("returns challenge only for unauthenticated user", async () => {
      const mockChallenge = createMockChallenge();

      const mockSupabaseClientForChallenge = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: null }, error: null }),
        },
      };

      const mockAdminClientBase = {
        from: vi.fn((table: string) => {
          const chain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn(),
          };

          if (table === "daily_challenges") {
            chain.single.mockResolvedValue({
              data: { perfume_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
              error: null,
            });
          } else if (table === "perfumes") {
            chain.single.mockResolvedValue({
              data: {
                base_notes: [],
                brands: { name: "Test" },
                concentrations: { name: "EDP" },
                gender: "Unisex",
                is_linear: false,
                middle_notes: [],
                name: "Test",
                perfumers: [],
                release_year: 2020,
                top_notes: [],
                xsolve_score: 100,
              },
              error: null,
            });
          }

          return chain;
        }),
      };

      const mockAdminClient = withPublicView(
        mockAdminClientBase,
        createPublicViewChain({
          challenge_date: mockChallenge.challenge_date,
          grace_deadline_at_utc: mockChallenge.grace_deadline_at_utc,
          id: mockChallenge.id,
          mode: mockChallenge.mode,
          snapshot_metadata: mockChallenge.snapshot_metadata,
        }),
      );

      const mockSupabaseClientForStart = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "Unauthorized" },
          }),
        },
      };

      vi.mocked(createClient)
        .mockResolvedValueOnce(mockSupabaseClientForChallenge as never)
        .mockResolvedValueOnce(mockSupabaseClientForStart as never);

      vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

      const result = await initializeGame();

      expect(result.challenge).not.toBeNull();
      expect(result.session).toBeNull();
    });

    it("returns null when no challenge exists", async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      const mockAdminClient = withPublicView(
        { from: vi.fn() },
        createPublicViewChain(null, {
          code: "PGRST116",
          message: "No rows found",
        }),
      );

      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
      vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

      const result = await initializeGame();

      expect(result.challenge).toBeNull();
      expect(result.session).toBeNull();
    });
  });

  // ==================== submitGuess Tests ====================

  describe("submitGuess", () => {
    const mockSessionId = "123e4567-e89b-12d3-a456-426614174000";
    const mockPerfumeId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const mockClientNonce = "nonce-abc-123";
    const mockUserId = "user-test-789";

    describe("correct guess", () => {
      it("detects correct guess and marks game as won", async () => {
        const sessionData = {
          attempts_count: 2,
          challenge_id: "550e8400-e29b-41d4-a716-446655440000",
          guesses: [],
          id: mockSessionId,
          last_nonce: mockClientNonce,
          player_id: mockUserId,
          start_time: new Date().toISOString(),
          status: "active",
        };

        // Move callCount outside to persist across multiple from("game_sessions") calls
        let sessionCallCount = 0;

        // First createClient for submitGuess
        const mockSupabaseClient1 = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockUserId } },
              error: null,
            }),
          },
          from: vi.fn((table: string) => {
            const chain: Record<string, unknown> = {
              eq: vi.fn().mockReturnThis(),
              insert: vi
                .fn()
                .mockResolvedValue({ data: { id: "result-123" }, error: null }),
              limit: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              update: vi.fn().mockReturnThis(),
            };

            if (table === "game_sessions") {
              // First call: initial session query, Second call: after update
              chain.single = vi.fn().mockImplementation(() => {
                sessionCallCount++;
                return sessionCallCount === 1
                  ? { data: sessionData, error: null }
                  : {
                      data: {
                        ...sessionData,
                        attempts_count: 3,
                        status: "won",
                      },
                      error: null,
                    };
              });
            } else if (table === "game_results") {
              chain.insert = vi.fn().mockResolvedValue({
                data: { id: "result-123" },
                error: null,
              });
            }

            return chain;
          }),
        };

        // Second createClient for getImageUrlForStep
        const mockSupabaseClient2 = createComprehensiveSupabaseMock({
          gameSessions: sessionData,
          perfumeAssets: [{ image_url: "https://example.com/won-perfume.jpg" }],
          user: { id: mockUserId },
        });

        // Move callCount outside to persist across multiple from("perfumes") calls
        let _perfumeCallCount = 0;

        const mockAdminClient = {
          from: vi.fn((table: string) => {
            const chain: Record<string, unknown> = {
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
              order: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            };

            switch (table) {
              case "daily_challenges": {
                chain.single = vi.fn().mockResolvedValue({
                  data: {
                    challenge_date: "2026-02-12",
                    grace_deadline_at_utc: "2026-02-13T00:00:00Z",
                    perfume_id: mockPerfumeId, // Same as guess!
                  },
                  error: null,
                });

                break;
              }
              case "perfumes": {
                // For both guessed and answer perfume (same ID) - called twice in Promise.all
                chain.single = vi.fn().mockImplementation(() => {
                  _perfumeCallCount++;
                  // Both queries should return the same data since it's the correct guess
                  return {
                    data: {
                      base_notes: ["Musk"],
                      brand_id: "brand-123",
                      concentrations: { name: "EDP" },
                      gender: "Unisex",
                      middle_notes: ["Rose"],
                      name: "Correct Perfume",
                      perfumers: ["Test Perfumer"],
                      release_year: 2020,
                      top_notes: ["Bergamot"],
                      xsolve_score: 100,
                    },
                    error: null,
                  };
                });

                break;
              }
              case "perfume_assets": {
                chain.single = vi.fn().mockResolvedValue({
                  data: {
                    image_key_step_1: "step1.jpg",
                    image_key_step_2: "step2.jpg",
                    image_key_step_3: "step3.jpg",
                    image_key_step_4: "step4.jpg",
                    image_key_step_5: "step5.jpg",
                    image_key_step_6: "step6.jpg",
                  },
                  error: null,
                });

                break;
              }
              // No default
            }

            return chain;
          }),
        };

        vi.mocked(createClient)
          .mockResolvedValueOnce(mockSupabaseClient1 as never)
          .mockResolvedValueOnce(mockSupabaseClient2 as never);

        vi.mocked(createAdminClient).mockReturnValue(
          withGameWrites(mockAdminClient, {
            data: { ...sessionData, attempts_count: 3, status: "won" },
            error: null,
          }) as never,
        );

        const result = await submitGuess(
          mockSessionId,
          mockPerfumeId,
          mockClientNonce,
        );

        expect(result.result).toBe("correct");
        expect(result.gameStatus).toBe("won");
        expect(result.finalScore).toBeGreaterThan(0);
      });
    });

    describe("incorrect guess", () => {
      it("provides feedback for incorrect guess", async () => {
        const wrongPerfumeId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

        const sessionData = {
          attempts_count: 2,
          challenge_id: "550e8400-e29b-41d4-a716-446655440000",
          guesses: [],
          id: mockSessionId,
          last_nonce: mockClientNonce,
          player_id: mockUserId,
          start_time: new Date().toISOString(),
          status: "active",
        };

        // First createClient for submitGuess
        const mockSupabaseClient1 = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockUserId } },
              error: null,
            }),
          },
          from: vi.fn((table: string) => {
            const chain: Record<string, unknown> = {
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              update: vi.fn().mockReturnThis(),
            };

            if (table === "game_sessions") {
              chain.single = vi.fn().mockResolvedValueOnce({
                data: sessionData,
                error: null,
              });
              // After update
              chain.single = vi.fn().mockResolvedValue({
                data: { ...sessionData, attempts_count: 3 },
                error: null,
              });
            }

            if (table === "game_results") {
              chain.insert = vi
                .fn()
                .mockResolvedValue({ data: { id: "result-123" }, error: null });
            }

            return chain;
          }),
        };

        // Second createClient for getImageUrlForStep
        const mockSupabaseClient2 = createComprehensiveSupabaseMock({
          gameSessions: sessionData,
          perfumeAssets: [
            { image_url: "https://example.com/guess-perfume.jpg" },
          ],
          user: { id: mockUserId },
        });

        // Move callCount outside to persist across multiple from("perfumes") calls
        let _perfumeCallCount = 0;

        const mockAdminClient = {
          from: vi.fn((table: string) => {
            const chain: Record<string, unknown> = {
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
              order: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            };

            switch (table) {
              case "daily_challenges": {
                chain.single = vi.fn().mockResolvedValue({
                  data: {
                    challenge_date: "2026-02-12",
                    grace_deadline_at_utc: "2026-02-13T00:00:00Z",
                    perfume_id: "550e8400-e29b-41d4-a716-446655440000", // Correct answer, different from wrongPerfumeId
                  },
                  error: null,
                });

                break;
              }
              case "perfumes": {
                // Return different data for guessed vs answer perfume
                chain.single = vi.fn().mockImplementation(() => {
                  _perfumeCallCount++;
                  return _perfumeCallCount === 1
                    ? {
                        data: {
                          base_notes: ["Amber"],
                          brand_id: "brand-wrong",
                          concentrations: { name: "EDT" },
                          gender: "Male",
                          middle_notes: ["Lavender"],
                          perfumers: ["Other Perfumer"],
                          release_year: 2015,
                          top_notes: ["Lemon"],
                        },
                        error: null,
                      }
                    : {
                        data: {
                          base_notes: ["Musk"],
                          brand_id: "brand-correct",
                          concentrations: { name: "EDP" },
                          middle_notes: ["Rose"],
                          name: "Correct Perfume",
                          perfumers: ["Correct Perfumer"],
                          release_year: 2020,
                          top_notes: ["Bergamot"],
                        },
                        error: null,
                      };
                });

                break;
              }
              case "perfume_assets": {
                chain.single = vi.fn().mockResolvedValue({
                  data: {
                    image_key_step_1: "step1.jpg",
                    image_key_step_2: "step2.jpg",
                    image_key_step_3: "step3.jpg",
                    image_key_step_4: "step4.jpg",
                    image_key_step_5: "step5.jpg",
                    image_key_step_6: "step6.jpg",
                  },
                  error: null,
                });

                break;
              }
              // No default
            }

            return chain;
          }),
        };

        vi.mocked(createClient)
          .mockResolvedValueOnce(mockSupabaseClient1 as never)
          .mockResolvedValueOnce(mockSupabaseClient2 as never);

        vi.mocked(createAdminClient).mockReturnValue(
          withGameWrites(mockAdminClient, {
            data: { ...sessionData, attempts_count: 3 },
            error: null,
          }) as never,
        );

        const result = await submitGuess(
          mockSessionId,
          wrongPerfumeId,
          mockClientNonce,
        );

        expect(result.result).toBe("incorrect");
        expect(result.gameStatus).toBe("active");
        expect(result.feedback.brandMatch).toBe(false);
        expect(result.feedback.yearDirection).toBe("higher"); // 2015 < 2020
        expect(result.feedback.perfumerMatch).toBe("none");
      });
    });

    describe("error cases", () => {
      it("throws error when user not authenticated", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: { message: "Not authenticated" },
            }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await expect(
          submitGuess(mockSessionId, mockPerfumeId, mockClientNonce),
        ).rejects.toThrow("Unauthorized");
      });

      it("throws error when session not found", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockUserId } },
              error: null,
            }),
          },
          from: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            }),
          })),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await expect(
          submitGuess(mockSessionId, mockPerfumeId, mockClientNonce),
        ).rejects.toThrow("Session not found");
      });

      it("throws conflict error when nonce mismatch (optimistic locking)", async () => {
        const wrongNonce = "wrong-nonce-456";

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockUserId } },
              error: null,
            }),
          },
          from: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                attempts_count: 2,
                challenge_id: "550e8400-e29b-41d4-a716-446655440000",
                guesses: [],
                id: mockSessionId,
                last_nonce: "correct-nonce-789", // Different!
                player_id: mockUserId,
                start_time: new Date().toISOString(),
                status: "active",
              },
              error: null,
            }),
          })),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await expect(
          submitGuess(mockSessionId, mockPerfumeId, wrongNonce),
        ).rejects.toThrow("CONFLICT");
      });

      it("returns inactive status when game already finished", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockUserId } },
              error: null,
            }),
          },
          from: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                attempts_count: 3,
                challenge_id: "550e8400-e29b-41d4-a716-446655440000",
                guesses: [],
                id: mockSessionId,
                last_nonce: mockClientNonce,
                player_id: mockUserId,
                start_time: new Date().toISOString(),
                status: "won", // Already won!
              },
              error: null,
            }),
          })),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await submitGuess(
          mockSessionId,
          mockPerfumeId,
          mockClientNonce,
        );

        expect(result.gameStatus).toBe("won");
        expect(result.result).toBe("incorrect");
      });
    });
  });

  // ==================== Server-computed clues ====================

  describe("server-computed clues", () => {
    const SESSION_ID = "123e4567-e89b-12d3-a456-426614174000";
    const CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";
    const ANSWER_ID = "a47ac10b-58cc-4372-a567-0e02b2c3d479";
    const GUESS_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const NONCE = "nonce-1";
    const USER_ID = "user-clues";

    const answerRow = {
      base_notes: ["Vanilla"],
      brand_id: "brand-chanel",
      brands: { name: "Chanel" },
      concentrations: { name: "EDP" },
      gender: "Feminine",
      id: ANSWER_ID,
      is_linear: false,
      middle_notes: ["Rose"],
      name: "Coco",
      perfumers: ["Jacques Polge"],
      release_year: 2001,
      top_notes: ["Bergamot"],
      xsolve_score: 0.5,
    };
    const guessedRow = {
      ...answerRow,
      brand_id: "brand-other",
      brands: { name: "Dior" },
      gender: "feminine",
      id: GUESS_ID,
      name: "J'adore",
      perfumers: ["Someone"],
      release_year: 2010,
    };

    /** Awaitable chain: every builder method returns the chain, which resolves to `value`. */
    function thenable(value: unknown) {
      const p = Promise.resolve(value);
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "limit", "order", "update"]) {
        chain[method] = vi.fn().mockReturnValue(chain);
      }
      chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
      chain.single = vi.fn().mockResolvedValue(value);
      chain.maybeSingle = chain.single;
      // eslint-disable-next-line unicorn/no-thenable -- necessary for Supabase chain mocking
      chain.then = p.then.bind(p);
      return chain;
    }

    const historyOk = { data: [guessedRow], error: null };

    function mockAdmin(historyResult: unknown = historyOk) {
      const from = vi.fn((table: string) => {
        switch (table) {
          case "daily_challenges": {
            return thenable({
              data: {
                grace_deadline_at_utc: "2999-01-01T00:00:00Z",
                perfume_id: ANSWER_ID,
              },
              error: null,
            });
          }
          case "daily_challenges_public": {
            return thenable({
              data: { grace_deadline_at_utc: "2999-01-01T00:00:00Z" },
              error: null,
            });
          }
          case "perfume_assets": {
            return thenable({
              data: {
                image_key_step_1: "s1.jpg",
                image_key_step_6: "s6.jpg",
              },
              error: null,
            });
          }
          case "perfumes": {
            // Awaited list (.in) returns the guessed perfume; .single() is keyed by id.
            const chain = thenable(historyResult);
            const eq = vi.fn((_column: string, id: string) => {
              chain.single = vi.fn().mockResolvedValue({
                data: id === GUESS_ID ? guessedRow : answerRow,
                error: null,
              });
              return chain;
            });
            chain.eq = eq;
            return chain;
          }
          case "game_sessions": {
            // Session writes echo the stored row, as the service role returns it.
            const chain = thenable({ data: null, error: null });
            chain.update = vi.fn((values: Record<string, unknown>) => {
              chain.single = vi.fn().mockResolvedValue({
                data: { ...baseSession, ...values },
                error: null,
              });
              return chain;
            });
            return chain;
          }
          default: {
            return thenable({ data: null, error: null });
          }
        }
      });
      vi.mocked(createAdminClient).mockReturnValue({ from } as never);
      return from;
    }

    function mockUserClient(session: Record<string, unknown>) {
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
          }),
        },
        from: vi.fn((table: string) =>
          table === "game_sessions"
            ? thenable({ data: session, error: null })
            : thenable({ data: null, error: null }),
        ),
      };
      vi.mocked(createClient).mockResolvedValue(client as never);
    }

    const baseSession = {
      attempts_count: 0,
      challenge_id: CHALLENGE_ID,
      guesses: [],
      id: SESSION_ID,
      last_nonce: NONCE,
      player_id: USER_ID,
      start_time: new Date().toISOString(),
      status: "active",
    };

    it("startGame takes the level from attempts_count for a resumed session", async () => {
      mockAdmin();
      mockUserClient({ ...baseSession, attempts_count: 2 });

      const result = await startGame(CHALLENGE_ID);

      expect(result.revealed.year).toBe(`20${MASK_CHAR.repeat(2)}`);
      expect(result.revealed.gender).toBeNull();
    });

    it("submitGuess on attempt 1 returns level-2 clues and genderMatch", async () => {
      mockAdmin();
      mockUserClient(baseSession);

      const result = await submitGuess(SESSION_ID, GUESS_ID, NONCE);

      expect(result.feedback.genderMatch).toBe(true);
      expect(result.revealed.year).toBe(`2${MASK_CHAR.repeat(3)}`);
      expect(result.revealed.brand).not.toBe("Chanel");
      expect(result.revealed.genderRevealed).toBe(true);
    });

    it("submitGuess fails before saving when the guess history cannot be read", async () => {
      const adminFrom = mockAdmin({
        data: null,
        error: { message: "connection reset" },
      });
      const sessionChain = thenable({
        data: {
          ...baseSession,
          attempts_count: 1,
          guesses: [{ isCorrect: false, perfumeId: GUESS_ID, timestamp: "t" }],
        },
        error: null,
      });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
          }),
        },
        from: vi.fn(() => sessionChain),
      } as never);

      await expect(submitGuess(SESSION_ID, GUESS_ID, NONCE)).rejects.toThrow(
        "Guess history unavailable",
      );
      expect(adminFrom).not.toHaveBeenCalledWith("game_sessions");
    });

    it("submitGuess on a finished session returns fully revealed clues", async () => {
      mockAdmin();
      mockUserClient({ ...baseSession, attempts_count: 2, status: "lost" });

      const result = await submitGuess(SESSION_ID, GUESS_ID, NONCE);

      expect(result.gameStatus).toBe("lost");
      expect(result.revealed).toMatchObject({
        brand: "Chanel",
        gender: "Feminine",
        perfumer: "Jacques Polge",
        year: "2001",
      });
    });

    it("a correct guess returns fully revealed clues", async () => {
      mockAdmin();
      mockUserClient(baseSession);

      const result = await submitGuess(SESSION_ID, ANSWER_ID, NONCE);

      expect(result.result).toBe("correct");
      expect(result.revealed).toMatchObject({
        brand: "Chanel",
        notes: {
          base: ["Vanilla"],
          heart: ["Rose"],
          kind: "pyramid",
          top: ["Bergamot"],
        },
        perfumer: "Jacques Polge",
        year: "2001",
      });
    });
  });
});
