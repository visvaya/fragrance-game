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
        await startGame("550e8400-e29b-41d4-a716-446655440001");
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
              challenge_id: "550e8400-e29b-41d4-a716-446655440001",
              guesses: [],
              id: "123e4567-e89b-12d3-a456-426614174002",
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
              perfume_id: "f47a-58cc-4372-a567-0e02b2c3d470",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const result = await startGame("550e8400-e29b-41d4-a716-446655440001");

      expect(result.sessionId).toBe("123e4567-e89b-12d3-a456-426614174002");
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge_id: "550e8400-e29b-41d4-a716-446655440001",
          player_id: "user-123",
        }),
      );
    });
  });

  describe("submitGuess", () => {
    it("handles correct guess", async () => {
      const mockUser = { id: "user-123" };
      const sessionId = "123e4567-e89b-12d3-a456-426614174001";
      const perfumeId = "f47ac10b-58cc-4372-a567-0e02b2c3d471";
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
              challenge_id: "550e8400-e29b-41d4-a716-446655440002",
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
          challenge_id: "550e8400-e29b-41d4-a716-446655440002",
          guesses: [],
          id: "123e4567-e89b-12d3-a456-426614174003",
          last_nonce: "wrong-nonce",
          player_id: "user-123",
          start_time: "...",
          status: "active",
        },
        error: null,
      } as any);

      await expect(submitGuess("123e4567-e89b-12d3-a456-426614174003", "f47a-58cc-4372-a567-0e02b2c3d470", "123")).rejects.toThrow(/CONFLICT/);
    });
  });
});
