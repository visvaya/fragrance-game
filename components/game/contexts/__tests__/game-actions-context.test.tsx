import type { ReactNode } from "react";

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { GameActionsProvider, useGameActions } from "../game-actions-context";

import type { Attempt } from "../game-state-context";

// Mock server actions
vi.mock("@/app/actions/game-actions", () => ({
  initializeGame: vi.fn(),
  resetGame: vi.fn(),
  submitGuess: vi.fn(),
}));

const MOCK_PERFUME = {
  brand: "Dior",
  concentration: "EDP",
  gender: "Unisex",
  id: "test",
  imageUrl: "/test.jpg",
  isLinear: false,
  name: "Mystery",
  notes: {
    base: ["Vanilla", "Musk", "Amber"],
    heart: ["Rose", "Jasmine", "Lily"],
    top: ["Bergamot", "Lemon", "Neroli"],
  },
  perfumer: "François Demachy",
  xsolve: 0.5,
  year: 1979,
};

const createWrapper = (
  overrides?: Partial<Parameters<typeof GameActionsProvider>[0]>,
) => {
  const defaultProps = {
    attempts: [],
    dailyPerfume: MOCK_PERFUME,
    gameState: "playing" as const,
    isBrandRevealed: false,
    isYearRevealed: false,
    maxAttempts: 6,
    nonce: "test-nonce",
    posthog: null,
    sessionId: "test-session",
    setAttempts: vi.fn(),
    setDailyPerfume: vi.fn(),
    setDiscoveredPerfumers: vi.fn(),
    setGameState: vi.fn(),
    setImageUrl: vi.fn(),
    setLoading: vi.fn(),
    setNonce: vi.fn(),
    setSessionId: vi.fn(),
    ...overrides,
  };

  return ({ children }: { children: ReactNode }) => (
    <GameActionsProvider {...defaultProps}>{children}</GameActionsProvider>
  );
};

describe("GameActionsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide game actions", () => {
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.makeGuess).toBeDefined();
    expect(result.current.resetGame).toBeDefined();
    expect(typeof result.current.makeGuess).toBe("function");
    expect(typeof result.current.resetGame).toBe("function");
  });

  it("should not allow guess when game is not playing", async () => {
    const setAttempts = vi.fn();
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        gameState: "won",
        setAttempts,
      }),
    });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(setAttempts).not.toHaveBeenCalled();
  });

  it("should not allow guess when no session", async () => {
    const setAttempts = vi.fn();
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        sessionId: null,
        setAttempts,
      }),
    });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(setAttempts).not.toHaveBeenCalled();
  });

  it("should not allow guess when max attempts reached", async () => {
    const mockAttempts: Attempt[] = Array.from<Attempt>({ length: 6 }).fill({
      brand: "Test",
      feedback: {
        brandMatch: false,
        notesMatch: 0,
        perfumerMatch: "none",
        yearDirection: "higher",
        yearMatch: "wrong",
      },
      guess: "Test",
    });
    const setAttempts = vi.fn();
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        attempts: mockAttempts,
        setAttempts,
      }),
    });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(setAttempts).not.toHaveBeenCalled();
  });

  it("should not allow reset when no session", async () => {
    const setLoading = vi.fn();
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        sessionId: null,
        setLoading,
      }),
    });

    await act(async () => {
      await result.current.resetGame();
    });

    expect(setLoading).not.toHaveBeenCalled();
  });

  it("should throw error when used outside provider", () => {
    expect(() => {
      renderHook(() => useGameActions());
    }).toThrow("useGameActions must be used within GameActionsProvider");
  });
});
