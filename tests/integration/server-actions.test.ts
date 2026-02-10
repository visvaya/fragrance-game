import { describe, it, expect, vi, beforeEach } from "vitest";
import { startGame, submitGuess } from "@/app/actions/game-actions";

// --- Mocks ---

const mockSupabase = {
    auth: {
        getUser: vi.fn(),
    },
    from: vi.fn((table) => {
        mockSupabase._lastTable = table;
        return mockSupabase;
    }),
    select: vi.fn(() => mockSupabase),
    insert: vi.fn(() => mockSupabase),
    update: vi.fn(() => mockSupabase),
    eq: vi.fn(() => mockSupabase),
    order: vi.fn(() => mockSupabase),
    limit: vi.fn(() => mockSupabase),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    in: vi.fn(() => mockSupabase),
    _lastTable: ""
};

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => mockSupabase),
    createAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/analytics-server", () => ({
    trackEvent: vi.fn(),
    identifyUser: vi.fn(),
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
if (!global.crypto) {
    (global as any).crypto = {
        getRandomValues: (arr: any) => {
            for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 100);
            return arr;
        },
    };
}

describe("Game Actions Integration (Mocked)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("startGame", () => {
        it("throws unauthorized if no user", async () => {
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

            let error;
            try {
                await startGame("challenge-1");
            } catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
            expect((error as any).message).toContain("Unauthorized");
        });

        it("starts new session if none exists", async () => {
            const mockUser = { id: "user-123" };
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

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
                    return { data: { id: "session-456", last_nonce: "123", status: "active", attempts_count: 0, challenge_id: "challenge-1", player_id: "user-123", guesses: [], start_time: "..." }, error: null };
                }
                if (table === "daily_challenges_public" || table === "daily_challenges") {
                    return { data: { perfume_id: "p1", grace_deadline_at_utc: "2026-01-01T00:00:00Z" }, error: null };
                }
                return { data: null, error: null };
            });

            const result = await startGame("challenge-1");

            expect(result.sessionId).toBe("session-456");
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                player_id: "user-123",
                challenge_id: "challenge-1",
            }));
        });
    });

    describe("submitGuess", () => {
        it("handles correct guess", async () => {
            const mockUser = { id: "user-123" };
            const sessionId = "session-1";
            const perfumeId = "perfume-correct";
            const nonce = "123";

            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

            let callCount = 0;
            mockSupabase.single.mockImplementation(async () => {
                const table = (mockSupabase as any)._lastTable;
                if (table === "game_sessions") {
                    const status = callCount > 0 ? "won" : "active";
                    callCount++;
                    return { data: { id: sessionId, last_nonce: nonce, status: status, attempts_count: 0, challenge_id: "c1", player_id: "user-123", guesses: [], start_time: new Date().toISOString() }, error: null };
                }
                if (table === "daily_challenges") {
                    return { data: { perfume_id: perfumeId }, error: null };
                }
                if (table === "perfumes") {
                    return { data: { id: perfumeId, brand_id: "b1", release_year: 2020, top_notes: [], middle_notes: [], base_notes: [], perfumers: [], concentrations: { name: "EDP" } }, error: null };
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
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });

            mockSupabase.single.mockResolvedValueOnce({
                data: { id: "s1", last_nonce: "wrong-nonce", status: "active", attempts_count: 0, challenge_id: "c1", player_id: "user-123", guesses: [], start_time: "..." },
                error: null
            } as any);

            await expect(submitGuess("s1", "p1", "123")).rejects.toThrow(/CONFLICT/);
        });
    });
});
