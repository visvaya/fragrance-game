import type { ReactNode } from "react";

import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  GameStateProvider,
  useGameState,
  type Attempt,
} from "../game-state-context";

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
  overrides?: Partial<Parameters<typeof GameStateProvider>[0]>,
) => {
  const defaultProps = {
    attempts: [],
    dailyPerfume: MOCK_PERFUME,
    discoveredPerfumers: new Set<string>(),
    gameState: "playing" as const,
    loading: false,
    maxAttempts: 6,
    sessionId: "test-session",
    ...overrides,
  };

  return ({ children }: { children: ReactNode }) => (
    <GameStateProvider {...defaultProps}>{children}</GameStateProvider>
  );
};

describe("GameStateContext", () => {
  it("should provide initial game state", () => {
    const { result } = renderHook(() => useGameState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.attempts).toEqual([]);
    expect(result.current.currentAttempt).toBe(1);
    expect(result.current.gameState).toBe("playing");
    expect(result.current.maxAttempts).toBe(6);
    expect(result.current.revealLevel).toBe(1);
  });

  it("should compute revealedBrand progressively", () => {
    // Level 1: Masked
    const { result: level1 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: [] }),
    });
    expect(level1.current.revealedBrand).toBe("?????");

    // Level 3: 15% revealed
    const mockAttempts: Attempt[] = [
      {
        brand: "Test",
        feedback: {
          brandMatch: false,
          notesMatch: 0,
          perfumerMatch: "none",
          yearDirection: "higher",
          yearMatch: "wrong",
        },
        guess: "Test",
      },
      {
        brand: "Test2",
        feedback: {
          brandMatch: false,
          notesMatch: 0,
          perfumerMatch: "none",
          yearDirection: "higher",
          yearMatch: "wrong",
        },
        guess: "Test2",
      },
    ];
    const { result: level3 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: mockAttempts }),
    });
    // Should be partially revealed (15%)
    expect(level3.current.revealedBrand).not.toBe("?????");
    expect(level3.current.revealedBrand).not.toBe("Dior");
  });

  it("should reveal brand on correct guess", () => {
    const mockAttempts: Attempt[] = [
      {
        brand: "Dior",
        feedback: {
          brandMatch: true,
          notesMatch: 0,
          perfumerMatch: "none",
          yearDirection: "higher",
          yearMatch: "wrong",
        },
        guess: "Test",
      },
    ];
    const { result } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: mockAttempts }),
    });
    expect(result.current.revealedBrand).toBe("Dior");
  });

  it("should compute revealedYear progressively", () => {
    // Level 1: ____
    const { result: level1 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: [] }),
    });
    expect(level1.current.revealedYear).toBe("____");

    // Level 2: 1___
    const mockAttempts1: Attempt[] = [
      {
        brand: "Test",
        feedback: {
          brandMatch: false,
          notesMatch: 0,
          perfumerMatch: "none",
          yearDirection: "higher",
          yearMatch: "wrong",
        },
        guess: "Test",
      },
    ];
    const { result: level2 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: mockAttempts1 }),
    });
    expect(level2.current.revealedYear).toBe("1___");
  });

  it("should compute visibleNotes progressively", () => {
    // Level 1: Placeholders
    const { result: level1 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: [] }),
    });
    expect(level1.current.visibleNotes.top).toEqual([
      "?????",
      "?????",
      "?????",
    ]);

    // Level 3: Top revealed, others masked
    const mockAttempts: Attempt[] = [
      {
        brand: "Test",
        feedback: {
          brandMatch: false,
          notesMatch: 0,
          perfumerMatch: "none",
          yearDirection: "higher",
          yearMatch: "wrong",
        },
        guess: "Test",
      },
      {
        brand: "Test2",
        feedback: {
          brandMatch: false,
          notesMatch: 0,
          perfumerMatch: "none",
          yearDirection: "higher",
          yearMatch: "wrong",
        },
        guess: "Test2",
      },
    ];
    const { result: level3 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: mockAttempts }),
    });
    expect(level3.current.visibleNotes.top).toEqual([
      "Bergamot",
      "Lemon",
      "Neroli",
    ]);
    expect(level3.current.visibleNotes.heart?.[0]).toContain("_"); // Masked
  });

  it("should compute blurLevel progressively", () => {
    const { result: level1 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: [] }),
    });
    expect(level1.current.blurLevel).toBe(10);

    // Game over: blur = 0
    const { result: won } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ gameState: "won" }),
    });
    expect(won.current.blurLevel).toBe(0);
  });

  it("should compute potentialScore based on attempt", () => {
    const { result: attempt1 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: [] }),
    });
    expect(attempt1.current.potentialScore).toBe(1000);

    const mockAttempts: Attempt[] = [
      {
        brand: "Test",
        feedback: {
          brandMatch: false,
          notesMatch: 0,
          perfumerMatch: "none",
          yearDirection: "higher",
          yearMatch: "wrong",
        },
        guess: "Test",
      },
    ];
    const { result: attempt2 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: mockAttempts }),
    });
    expect(attempt2.current.potentialScore).toBe(700);
  });

  it("should set boolean flags correctly", () => {
    const mockAttempts: Attempt[] = [
      {
        brand: "Dior",
        feedback: {
          brandMatch: true,
          notesMatch: 0,
          perfumerMatch: "none",
          yearDirection: "equal",
          yearMatch: "correct",
        },
        guess: "Test",
        year: 1979,
      },
    ];
    const { result } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: mockAttempts }),
    });
    expect(result.current.isBrandRevealed).toBe(true);
    expect(result.current.isYearRevealed).toBe(true);
  });

  it("should throw error when used outside provider", () => {
    expect(() => {
      renderHook(() => useGameState());
    }).toThrow("useGameState must be used within GameStateProvider");
  });
});
