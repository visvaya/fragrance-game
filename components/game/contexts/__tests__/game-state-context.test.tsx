import type { ReactNode } from "react";

import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { HIDDEN_CLUES, type RevealedClues } from "@/lib/game/clue-reveal";

import {
  GameStateProvider,
  useGameState,
  type Attempt,
  type DailyPerfume,
} from "../game-state-context";

const MOCK_PERFUME: DailyPerfume = {
  concentration: "EDP",
  id: "test",
  imageUrl: "/test.jpg",
  name: "Mystery",
  xsolve: 0.5,
};

const SERVER_CLUES: RevealedClues = {
  answerHas: {
    brand: true,
    gender: true,
    notes: true,
    perfumer: true,
    year: true,
  },
  brand: "D__r",
  brandRevealed: false,
  gender: "Unisex",
  genderRevealed: true,
  notes: {
    base: ["_______", "____", "_____"],
    heart: ["____", "_______", "____"],
    kind: "pyramid",
    top: ["Bergamot", "Lemon", "Neroli"],
  },
  perfumer: "F_______ D______",
  perfumerCount: 1,
  year: "19__",
  yearRevealed: false,
};

const WRONG_ATTEMPT: Attempt = {
  brand: "Test",
  feedback: {
    brandMatch: false,
    genderMatch: false,
    notesMatch: 0,
    perfumerMatch: "none",
    yearDirection: "higher",
    yearMatch: "wrong",
  },
  guess: "Test",
};

const createWrapper = (
  overrides?: Partial<Parameters<typeof GameStateProvider>[0]>,
) => {
  const defaultProps = {
    attempts: [],
    clues: SERVER_CLUES,
    dailyPerfume: MOCK_PERFUME,
    gameState: "playing" as const,
    loading: false,
    maxAttempts: 6,
    sessionId: "test-session",
    sessionReady: true,
    user: null,
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

  it("returns the server clues exactly as received", () => {
    const { result } = renderHook(() => useGameState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.clues).toBe(SERVER_CLUES);
    expect(result.current.revealedBrand).toBe("D__r");
    expect(result.current.revealedPerfumer).toBe("F_______ D______");
    expect(result.current.revealedYear).toBe("19__");
    expect(result.current.revealedGender).toBe("Unisex");
    expect(result.current.isBrandRevealed).toBe(false);
    expect(result.current.isYearRevealed).toBe(false);
    expect(result.current.isGenderRevealed).toBe(true);
    expect(result.current.visibleNotes).toEqual({
      base: ["_______", "____", "_____"],
      heart: ["____", "_______", "____"],
      top: ["Bergamot", "Lemon", "Neroli"],
    });
  });

  it("does not derive clues from attempts", () => {
    const { result } = renderHook(() => useGameState(), {
      wrapper: createWrapper({
        attempts: [
          {
            ...WRONG_ATTEMPT,
            feedback: {
              ...WRONG_ATTEMPT.feedback,
              brandMatch: true,
              yearMatch: "correct",
            },
          },
        ],
      }),
    });

    expect(result.current.revealedBrand).toBe("D__r");
    expect(result.current.isBrandRevealed).toBe(false);
    expect(result.current.isYearRevealed).toBe(false);
  });

  it("passes the reveal flags through from the server", () => {
    const { result } = renderHook(() => useGameState(), {
      wrapper: createWrapper({
        clues: { ...SERVER_CLUES, brandRevealed: true, yearRevealed: true },
      }),
    });

    expect(result.current.isBrandRevealed).toBe(true);
    expect(result.current.isYearRevealed).toBe(true);
  });

  it("renders with hidden clues and no answer fields", () => {
    const { result } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ clues: HIDDEN_CLUES }),
    });

    expect(result.current.revealedBrand).toBe(HIDDEN_CLUES.brand);
    expect(result.current.revealedYear).toBe(HIDDEN_CLUES.year);
    expect(result.current.revealedGender).toBe("Unknown");
    expect(result.current.isGenderRevealed).toBe(false);
    expect(result.current.dailyPerfume).not.toHaveProperty("brand");
    expect(result.current.dailyPerfume).not.toHaveProperty("notes");
  });

  it("keeps empty pyramid tiers for linear notes", () => {
    const { result } = renderHook(() => useGameState(), {
      wrapper: createWrapper({
        clues: {
          ...SERVER_CLUES,
          notes: { kind: "linear", notes: ["Iris", "____"] },
        },
      }),
    });

    expect(result.current.visibleNotes).toEqual({
      base: [],
      heart: [],
      top: [],
    });
  });

  it("should compute blurLevel progressively", () => {
    const { result: level1 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: [] }),
    });
    expect(level1.current.blurLevel).toBe(10);

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

    const { result: attempt2 } = renderHook(() => useGameState(), {
      wrapper: createWrapper({ attempts: [WRONG_ATTEMPT] }),
    });
    expect(attempt2.current.potentialScore).toBe(700);
  });

  it("should throw error when used outside provider", () => {
    expect(() => {
      renderHook(() => useGameState());
    }).toThrow("useGameState must be used within GameStateProvider");
  });
});
