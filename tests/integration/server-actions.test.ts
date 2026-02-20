import { describe, it, expect, vi, beforeEach } from "vitest";

import { startGame, submitGuess } from "@/app/actions/game-actions";

// --- Mocks ---

const mockSupabase = {
  _lastTable: "",
  auth: {
    getUser: vi.fn(),
  },
  eq: vi.fn(() => mockSupabase),
  from: vi.fn((table) => {
    mockSupabase._lastTable = table;
    return mockSupabase;
  }),
  in: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  maybeSingle: vi.fn(),
  order: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  single: vi.fn(),
  update: vi.fn(() => mockSupabase),
};

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => mockSupabase),
  createClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/analytics-server", () => ({
  identifyUser: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(),
    set: vi.fn(),
  })),
}));

// Mock crypto for nonce generation
if (!globalThis.crypto) {
  (globalThis as any).crypto = {
    getRandomValues: (array: any) => {
      for (let i = 0; i < array.length; i++)
        array[i] = Math.floor(Math.random() * 100);
      return array;
    },
  };
}

describe("Game Actions Integration (Mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startGame", () => {
    it("throws unauthorized if no user", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      let error;
      try {
        await startGame("challenge-1");
      } catch (error_) {
        error = error_;
      }
      expect(error).toBeDefined();
      expect((error as any).message).toContain("Unauthorized");
    });

    it("starts new session if none exists", async () => {
      const mockUser = { id: "user-123" };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // 1. Session check
      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

      // 2. Insert session
      mockSupabase.insert.mockReturnValue(mockSupabase);

      // 3. Chain of single() calls:
      // - After insert to get session
      // - To get challenge
      mockSupabase.single.mockImplementation(async () => {
        const table = (mockSupabase as any)._lastTable;
        if (table === "game_sessions") {
          return {
            data: {
              attempts_count: 0,
              challenge_id: "challenge-1",
              guesses: [],
              id: "session-456",
              last_nonce: "123",
              player_id: "user-123",
              start_time: "...",
              status: "active",
            },
            error: null,
          };
        }
        if (
          table === "daily_challenges_public" ||
          table === "daily_challenges"
        ) {
          return {
            data: {
              grace_deadline_at_utc: "2026-01-01T00:00:00Z",
              perfume_id: "p1",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const result = await startGame("challenge-1");

      expect(result.sessionId).toBe("session-456");
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge_id: "challenge-1",
          player_id: "user-123",
        }),
      );
    });
  });

  describe("submitGuess", () => {
    it("handles correct guess", async () => {
      const mockUser = { id: "user-123" };
      const sessionId = "session-1";
      const perfumeId = "perfume-correct";
      const nonce = "123";

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let callCount = 0;
      mockSupabase.single.mockImplementation(async () => {
        const table = (mockSupabase as any)._lastTable;
        if (table === "game_sessions") {
          const status = callCount > 0 ? "won" : "active";
          callCount++;
          return {
            data: {
              attempts_count: 0,
              challenge_id: "c1",
              guesses: [],
              id: sessionId,
              last_nonce: nonce,
              player_id: "user-123",
              start_time: new Date().toISOString(),
              status: status,
            },
            error: null,
          };
        }
        if (table === "daily_challenges") {
          return { data: { perfume_id: perfumeId }, error: null };
        }
        if (table === "perfumes") {
          return {
            data: {
              base_notes: [],
              brand_id: "b1",
              concentrations: { name: "EDP" },
              id: perfumeId,
              middle_notes: [],
              perfumers: [],
              release_year: 2020,
              top_notes: [],
            },
            error: null,
          };
        }
        if (table === "perfume_assets") {
          return { data: { image_key_step_1: "test.jpg" }, error: null };
        }
        return { data: null, error: null };
      });

      // For update
      mockSupabase.update.mockReturnValue(mockSupabase);

      const result = await submitGuess(sessionId, perfumeId, nonce);

      expect(result.result).toBe("correct");
      expect(result.gameStatus).toBe("won");
    });

    it("throws on nonce mismatch", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          attempts_count: 0,
          challenge_id: "c1",
          guesses: [],
          id: "s1",
          last_nonce: "wrong-nonce",
          player_id: "user-123",
          start_time: "...",
          status: "active",
        },
        error: null,
      } as any);

      await expect(submitGuess("s1", "p1", "123")).rejects.toThrow(/CONFLICT/);
    });
  });
});
