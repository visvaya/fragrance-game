import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Upstash modules before imports
vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      del: vi.fn(),
      // Mock Redis client methods
      get: vi.fn(),
      set: vi.fn(),
    })),
  },
}));

vi.mock("@upstash/ratelimit", () => {
  const mockSlidingWindow = vi.fn(() => ({}));

  // Use a factory instead of a class to avoid constructor-related lint issues
  const MockRatelimit = function (this: any) {
    this.limit = vi.fn().mockReturnValue(
      Promise.resolve({
        limit: 10,
        remaining: 5,
        reset: Date.now() + 60_000,
        success: true,
      }),
    );
  };

  MockRatelimit.slidingWindow = mockSlidingWindow;

  return {
    Ratelimit: MockRatelimit,
  };
});

// Import after mocks are set up
import { checkRateLimit, limiters } from "../redis";

describe("redis rate limiting", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe("limiters configuration", () => {
    it("defines rate limiters for all critical actions", () => {
      expect(limiters).toHaveProperty("autocomplete");
      expect(limiters).toHaveProperty("getDailyChallenge");
      expect(limiters).toHaveProperty("startGame");
      expect(limiters).toHaveProperty("submitGuess");
    });

    it("each limiter has a limit method", () => {
      expect(typeof limiters.autocomplete.limit).toBe("function");
      expect(typeof limiters.getDailyChallenge.limit).toBe("function");
      expect(typeof limiters.startGame.limit).toBe("function");
      expect(typeof limiters.submitGuess.limit).toBe("function");
    });
  });

  describe("checkRateLimit", () => {
    describe("success cases", () => {
      it("allows requests when under rate limit", async () => {
        // Mock limiter to return success
        const mockLimiter = limiters.autocomplete;
        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 60,
          pending: Promise.resolve(),
          remaining: 59,
          reset: Date.now() + 60_000,
          success: true,
        });

        await expect(
          checkRateLimit("autocomplete", "user-123"),
        ).resolves.not.toThrow();

        expect(mockLimiter.limit).toHaveBeenCalledWith("user-123");
        expect(mockLimiter.limit).toHaveBeenCalledTimes(1);
      });

      it("allows requests for different action types", async () => {
        const actions = [
          "autocomplete",
          "getDailyChallenge",
          "startGame",
          "submitGuess",
        ] as const;

        for (const action of actions) {
          const mockLimiter = limiters[action];
          vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
            limit: 10,
            pending: Promise.resolve(),
            remaining: 5,
            reset: Date.now() + 60_000,
            success: true,
          });

          await expect(
            checkRateLimit(action, "user-123"),
          ).resolves.not.toThrow();
        }
      });

      it("allows requests for different users independently", async () => {
        const mockLimiter = limiters.submitGuess;

        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 10,
          pending: Promise.resolve(),
          remaining: 9,
          reset: Date.now() + 60_000,
          success: true,
        });

        await expect(
          checkRateLimit("submitGuess", "user-123"),
        ).resolves.not.toThrow();

        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 10,
          pending: Promise.resolve(),
          remaining: 9,
          reset: Date.now() + 60_000,
          success: true,
        });

        await expect(
          checkRateLimit("submitGuess", "user-456"),
        ).resolves.not.toThrow();

        expect(mockLimiter.limit).toHaveBeenCalledWith("user-123");
        expect(mockLimiter.limit).toHaveBeenCalledWith("user-456");
      });
    });

    describe("rate limit exceeded", () => {
      it("throws error when rate limit exceeded", async () => {
        const mockLimiter = limiters.submitGuess;
        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 10,
          pending: Promise.resolve(),
          remaining: 0,
          reset: Date.now() + 60_000,
          success: false,
        });

        await expect(checkRateLimit("submitGuess", "user-123")).rejects.toThrow(
          "Rate limit exceeded for submitGuess. Please try again later.",
        );

        expect(mockLimiter.limit).toHaveBeenCalledWith("user-123");
      });

      it("throws error with correct action name in message", async () => {
        const actions = [
          "autocomplete",
          "getDailyChallenge",
          "startGame",
          "submitGuess",
        ] as const;

        for (const action of actions) {
          const mockLimiter = limiters[action];
          vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
            limit: 10,
            pending: Promise.resolve(),
            remaining: 0,
            reset: Date.now() + 60_000,
            success: false,
          });

          await expect(checkRateLimit(action, "user-123")).rejects.toThrow(
            `Rate limit exceeded for ${action}. Please try again later.`,
          );
        }
      });

      it("blocks rapid successive requests after limit reached", async () => {
        const mockLimiter = limiters.submitGuess;

        // First request succeeds
        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 10,
          pending: Promise.resolve(),
          remaining: 1,
          reset: Date.now() + 60_000,
          success: true,
        });

        await expect(
          checkRateLimit("submitGuess", "user-123"),
        ).resolves.not.toThrow();

        // Second request exceeds limit
        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 10,
          pending: Promise.resolve(),
          remaining: 0,
          reset: Date.now() + 60_000,
          success: false,
        });

        await expect(checkRateLimit("submitGuess", "user-123")).rejects.toThrow(
          "Rate limit exceeded",
        );
      });
    });

    describe("error handling", () => {
      it("propagates Redis connection errors", async () => {
        const mockLimiter = limiters.autocomplete;
        vi.mocked(mockLimiter.limit).mockRejectedValueOnce(
          new Error("Redis connection failed"),
        );

        await expect(
          checkRateLimit("autocomplete", "user-123"),
        ).rejects.toThrow("Redis connection failed");
      });

      it("handles network timeouts", async () => {
        const mockLimiter = limiters.getDailyChallenge;
        vi.mocked(mockLimiter.limit).mockRejectedValueOnce(
          new Error("Request timeout"),
        );

        await expect(
          checkRateLimit("getDailyChallenge", "user-123"),
        ).rejects.toThrow("Request timeout");
      });
    });

    describe("edge cases", () => {
      it("handles empty user ID", async () => {
        const mockLimiter = limiters.submitGuess;
        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 10,
          pending: Promise.resolve(),
          remaining: 9,
          reset: Date.now() + 60_000,
          success: true,
        });

        await expect(checkRateLimit("submitGuess", "")).resolves.not.toThrow();

        expect(mockLimiter.limit).toHaveBeenCalledWith("");
      });

      it("handles special characters in user ID", async () => {
        const specialUserId = "user@example.com:123!";
        const mockLimiter = limiters.autocomplete;

        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 60,
          pending: Promise.resolve(),
          remaining: 59,
          reset: Date.now() + 60_000,
          success: true,
        });

        await expect(
          checkRateLimit("autocomplete", specialUserId),
        ).resolves.not.toThrow();

        expect(mockLimiter.limit).toHaveBeenCalledWith(specialUserId);
      });
    });

    describe("security - action validation", () => {
      it("only accepts valid action types", async () => {
        // TypeScript should prevent invalid actions at compile time
        // This test verifies runtime behavior

        const validActions = [
          "autocomplete",
          "getDailyChallenge",
          "startGame",
          "submitGuess",
        ] as const;

        for (const action of validActions) {
          const mockLimiter = limiters[action];
          vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
            limit: 10,
            pending: Promise.resolve(),
            remaining: 5,
            reset: Date.now() + 60_000,
            success: true,
          });

          await expect(
            checkRateLimit(action, "user-123"),
          ).resolves.not.toThrow();
        }
      });
    });
  });

  describe("integration scenarios", () => {
    it("simulates brute force attack prevention on submitGuess", async () => {
      const userId = "attacker-123";
      const mockLimiter = limiters.submitGuess;

      // Simulate 9 rapid requests (limit is 10/minute)
      for (let i = 0; i < 9; i++) {
        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 10,
          pending: Promise.resolve(),
          remaining: 9 - i,
          reset: Date.now() + 60_000,
          success: true,
        });

        await expect(
          checkRateLimit("submitGuess", userId),
        ).resolves.not.toThrow();
      }

      vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
        limit: 10,
        pending: Promise.resolve(),
        remaining: 0,
        reset: Date.now() + 60_000,
        success: false,
      });

      await expect(checkRateLimit("submitGuess", userId)).rejects.toThrow(
        "Rate limit exceeded",
      );
    });

    it("allows legitimate user behavior (spaced requests)", async () => {
      const userId = "legitimate-user";
      const mockLimiter = limiters.autocomplete;

      // Simulate 3 spaced requests (well under 60/minute limit)
      for (let i = 0; i < 3; i++) {
        vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
          limit: 60,
          pending: Promise.resolve(),
          remaining: 60 - i - 1,
          reset: Date.now() + 60_000,
          success: true,
        });

        await expect(
          checkRateLimit("autocomplete", userId),
        ).resolves.not.toThrow();
      }

      expect(mockLimiter.limit).toHaveBeenCalledTimes(3);
    });

    it("treats anonymous and authenticated users independently", async () => {
      const mockLimiter = limiters.startGame;

      // Anonymous user (IP-based)
      vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
        limit: 5,
        pending: Promise.resolve(),
        remaining: 0,
        reset: Date.now() + 60_000,
        success: false,
      });

      await expect(
        checkRateLimit("startGame", "ip:192.168.1.1"),
      ).rejects.toThrow();

      // Authenticated user (still has quota)
      vi.mocked(mockLimiter.limit).mockResolvedValueOnce({
        limit: 5,
        pending: Promise.resolve(),
        remaining: 4,
        reset: Date.now() + 60_000,
        success: true,
      });

      await expect(
        checkRateLimit("startGame", "user:abc123"),
      ).resolves.not.toThrow();
    });
  });
});
