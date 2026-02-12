"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { revealLetters } from "@/lib/game/scoring";

// Re-export types from game-provider for convenience
export type AttemptFeedback = {
  brandMatch: boolean;
  notesMatch: number;
  perfumerMatch: "full" | "partial" | "none";
  yearDirection: "higher" | "lower" | "equal";
  yearMatch: "correct" | "close" | "wrong";
};

export type Attempt = {
  brand: string;
  concentration?: string;
  feedback: AttemptFeedback;
  gender?: string;
  guess: string;
  isCorrect?: boolean;
  perfumeId?: string;
  perfumers?: string[];
  snapshot?: {
    brandRevealed: boolean;
    genderRevealed: boolean;
    guessMaskedBrand: string;
    guessMaskedYear: string;
    yearRevealed: boolean;
  };
  year?: number;
};

type GameState = "playing" | "won" | "lost";

type DailyPerfume = {
  brand: string;
  concentration: string | undefined;
  gender: string;
  id: string;
  imageUrl: string;
  isLinear: boolean;
  name: string;
  notes: {
    base: string[];
    heart: string[];
    top: string[];
  };
  perfumer: string;
  xsolve: number;
  year: string | number;
};

type GameStateContextType = {
  // Core state
  attempts: Attempt[];
  blurLevel: number;
  currentAttempt: number;
  dailyPerfume: DailyPerfume;
  gameState: GameState;
  // Boolean flags (derived)
  isBrandRevealed: boolean;
  isGenderRevealed: boolean;
  isYearRevealed: boolean;
  loading: boolean;

  maxAttempts: number;
  potentialScore: number;
  // Memoized progressive reveal values (CONVERTED from getters)
  revealedBrand: string;

  revealedGender: string;
  revealedPerfumer: string;
  revealedYear: string;
  revealLevel: number;
  sessionId: string | null;
  visibleNotes: {
    base: string[] | null;
    heart: string[] | null;
    top: string[] | null;
  };
  xsolveScore: number;
};

const GameStateContext = createContext<GameStateContextType | undefined>(
  undefined,
);

type GameStateProviderProperties = {
  // State from parent orchestrator
  attempts: Attempt[];
  children: ReactNode;
  dailyPerfume: DailyPerfume;
  discoveredPerfumers: Set<string>;
  gameState: GameState;
  loading: boolean;
  maxAttempts: number;
  sessionId: string | null;
};

/**
 * GameStateProvider - Manages core game state with memoized progressive reveal
 * Expensive computations (brand/perfumer/year/notes reveal) are memoized with useMemo
 * to prevent redundant calculations on every render
 */
export function GameStateProvider({
  attempts,
  children,
  dailyPerfume,
  discoveredPerfumers,
  gameState,
  loading,
  maxAttempts,
  sessionId,
}: Readonly<GameStateProviderProperties>) {
  const currentAttempt = attempts.length + 1;
  const revealLevel = Math.min(currentAttempt, maxAttempts);

  // ===== PRIORITY P0: Most Expensive Getters =====

  /**
   * visibleNotes - O(n) array operations + multiple revealLetters() calls
   * Memoized to avoid recalculation on every render
   */
  const visibleNotes = useMemo(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    const hasPerfectNotes = attempts.some((a) => a.feedback.notesMatch >= 1);

    if (isGameOver || hasPerfectNotes) {
      return {
        base: dailyPerfume.notes.base,
        heart: dailyPerfume.notes.heart,
        top: dailyPerfume.notes.top,
      };
    }

    const mask = (notes: string[]) => notes.map((n) => revealLetters(n, 0));

    if (revealLevel >= 5) {
      return {
        base: dailyPerfume.notes.base,
        heart: dailyPerfume.notes.heart,
        top: dailyPerfume.notes.top,
      };
    }

    if (revealLevel === 4) {
      return {
        base: mask(dailyPerfume.notes.base || []),
        heart: dailyPerfume.notes.heart,
        top: dailyPerfume.notes.top,
      };
    }

    if (revealLevel === 3) {
      return {
        base: mask(dailyPerfume.notes.base || []),
        heart: mask(dailyPerfume.notes.heart || []),
        top: dailyPerfume.notes.top,
      };
    }

    if (revealLevel === 2) {
      return {
        base: mask(dailyPerfume.notes.base || []),
        heart: mask(dailyPerfume.notes.heart || []),
        top: mask(dailyPerfume.notes.top || []),
      };
    }

    // Level 1: Generic placeholders
    return {
      base: ["?????", "?????", "?????"],
      heart: ["?????", "?????", "?????"],
      top: ["?????", "?????", "?????"],
    };
  }, [revealLevel, dailyPerfume.notes, gameState, attempts]);

  /**
   * revealedPerfumer - String operations + split/map/join
   * Handles comma-separated perfumers with progressive reveal
   */
  const revealedPerfumer = useMemo(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver) return dailyPerfume.perfumer;

    const perfumers = dailyPerfume.perfumer.split(",").map((p) => p.trim());

    if (attempts.some((a) => a.feedback.perfumerMatch === "full"))
      return dailyPerfume.perfumer;

    if (perfumers.every((p) => discoveredPerfumers.has(p)))
      return dailyPerfume.perfumer;

    if (revealLevel === 1) return "?????";

    return perfumers
      .map((p) => {
        if (discoveredPerfumers.has(p)) return p;
        const percentages = [0, 0, 0.1, 0.3, 0.6, 1];
        return revealLetters(p, percentages[Math.min(revealLevel - 1, 5)]);
      })
      .join(", ");
  }, [
    revealLevel,
    dailyPerfume.perfumer,
    discoveredPerfumers,
    attempts,
    gameState,
  ]);

  /**
   * revealedBrand - String operations with revealLetters
   * Progressive reveal from center outward
   */
  const revealedBrand = useMemo(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver || attempts.some((a) => a.feedback.brandMatch))
      return dailyPerfume.brand;

    if (revealLevel === 1) return "?????";

    const percentages = [0, 0, 0.15, 0.4, 0.7, 1];
    return revealLetters(
      dailyPerfume.brand,
      percentages[Math.min(revealLevel - 1, 5)],
    );
  }, [revealLevel, dailyPerfume.brand, attempts, gameState]);

  // ===== PRIORITY P1: Moderate Cost Getters =====

  /**
   * revealedYear - String slicing operations
   * Progressive reveal digit-by-digit
   */
  const revealedYear = useMemo(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver || attempts.some((a) => a.feedback.yearMatch === "correct"))
      return dailyPerfume.year.toString();

    const year = dailyPerfume.year.toString();

    if (revealLevel >= 5) return year;
    if (revealLevel === 4) return year.slice(0, 3) + "_";
    if (revealLevel === 3) return year.slice(0, 2) + "__";
    if (revealLevel === 2) return year.slice(0, 1) + "___";
    return "____";
  }, [revealLevel, dailyPerfume.year, attempts, gameState]);

  /**
   * revealedGender - Simple string return
   * Revealed at game end or when gender discovered
   */
  const revealedGender = useMemo(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    const isRevealed = attempts.some(
      (a) =>
        a.snapshot?.genderRevealed ||
        a.gender?.toLowerCase() === dailyPerfume.gender.toLowerCase(),
    );
    if (isGameOver || isRevealed) return dailyPerfume.gender;
    return "Unknown";
  }, [gameState, attempts, dailyPerfume.gender]);

  // ===== PRIORITY P2: Lightweight Getters =====

  /**
   * blurLevel - Simple array lookup
   * Controls image blur effect
   */
  const blurLevel = useMemo(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver) return 0;
    const blurLevels = [10, 9.5, 8.5, 7.5, 6, 0];
    return blurLevels[Math.min(revealLevel - 1, 5)];
  }, [revealLevel, gameState]);

  /**
   * potentialScore - Simple array lookup
   * Shows points available for current attempt
   */
  const potentialScore = useMemo(() => {
    const baseScores = [1000, 700, 490, 343, 240, 168];
    return baseScores[Math.min(currentAttempt - 1, 5)];
  }, [currentAttempt]);

  // ===== Boolean Flags (Derived State) =====

  const isBrandRevealed = useMemo(
    () =>
      attempts.some((a) => a.feedback.brandMatch) ||
      revealedBrand === dailyPerfume.brand,
    [attempts, revealedBrand, dailyPerfume.brand],
  );

  const isYearRevealed = useMemo(
    () =>
      attempts.some((a) => a.feedback.yearMatch === "correct") ||
      revealedYear === dailyPerfume.year.toString(),
    [attempts, revealedYear, dailyPerfume.year],
  );

  const isGenderRevealed = useMemo(
    () =>
      attempts.some(
        (a) =>
          a.snapshot?.genderRevealed ||
          a.gender?.toLowerCase() === dailyPerfume.gender.toLowerCase(),
      ),
    [attempts, dailyPerfume.gender],
  );

  const value: GameStateContextType = {
    attempts,
    blurLevel,
    currentAttempt,
    dailyPerfume,
    gameState,
    isBrandRevealed,
    isGenderRevealed,
    isYearRevealed,
    loading,

    maxAttempts,
    potentialScore,
    // Direct values (not functions!)
    revealedBrand,
    revealedGender,
    revealedPerfumer,
    revealedYear,
    revealLevel,

    sessionId,
    visibleNotes,
    xsolveScore: dailyPerfume.xsolve,
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

/**
 * useGameState - Hook to access game state
 * Use this for components that need game data (clues, attempts, progress)
 */
export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error("useGameState must be used within GameStateProvider");
  }
  return context;
}
