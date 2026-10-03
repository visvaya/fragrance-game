"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { AttemptFeedback } from "@/lib/game/challenge-answer";
import type { RevealedClues } from "@/lib/game/clue-reveal";
import type { User } from "@supabase/supabase-js";

export type { AttemptFeedback } from "@/lib/game/challenge-answer";

export type Attempt = {
  brand: string;
  concentration?: string;
  feedback: AttemptFeedback;
  gender?: string;
  guess: string;
  hasGuessedNotes?: boolean; // True if guessed perfume has notes data
  isCorrect?: boolean;
  isSkipped?: boolean;
  perfumeId?: string;
  perfumers?: string[];
  year?: number;
};

export type GameState = "playing" | "won" | "lost";

/**
 * Public data of the daily perfume. Clue values (brand, notes, year...) live in
 * RevealedClues, computed on the server; the answer itself never reaches the browser.
 */
export type DailyPerfume = {
  concentration: string | undefined;
  id: string;
  imageUrl: string;
  name: string;
  xsolve: number;
};

const EMPTY_TIERS: GameStateContextType["visibleNotes"] = {
  base: [],
  heart: [],
  top: [],
};

/** Maps server clues to the reveal values exposed by useGameState(). */
function toRevealValues(clues: RevealedClues) {
  return {
    isBrandRevealed: clues.brandRevealed,
    isGenderRevealed: clues.genderRevealed,
    isYearRevealed: clues.yearRevealed,
    revealedBrand: clues.brand,
    revealedGender: clues.gender ?? "Unknown",
    revealedPerfumer: clues.perfumer,
    revealedYear: clues.year,
    visibleNotes:
      clues.notes.kind === "pyramid"
        ? {
            base: clues.notes.base,
            heart: clues.notes.heart,
            top: clues.notes.top,
          }
        : EMPTY_TIERS,
  };
}

type GameStateContextType = {
  // Core state
  attempts: Attempt[];
  /** True once anonymous auth JWT is ready — guards lazy startGame in game-actions-context */
  authReady: boolean;
  blurLevel: number;
  /** Clues computed on the server for the current progress. */
  clues: RevealedClues;
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
  revealedBrand: string;

  revealedGender: string;
  revealedPerfumer: string;
  revealedYear: string;
  revealLevel: number;
  sessionId: string | null;
  sessionReady: boolean;
  user: User | null;
  /** Pyramid tiers; empty for linear perfumes (read clues.notes instead). */
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
  /** True once anonymous auth JWT is ready — guards lazy startGame in game-actions-context */
  authReady?: boolean;
  /** Attempt count inherited from an anonymous session (declined migration). */
  baseAttemptCount?: number;
  children: ReactNode;
  clues: RevealedClues;
  dailyPerfume: DailyPerfume;
  gameState: GameState;
  loading: boolean;
  maxAttempts: number;
  sessionId: string | null;
  sessionReady: boolean;
  user: User | null;
};

/**
 * GameStateProvider - exposes core game state and the server-computed clues.
 * The provider never masks anything itself: it only passes clues through.
 */
export function GameStateProvider({
  attempts,
  authReady = false,
  baseAttemptCount = 0,
  children,
  clues,
  dailyPerfume,
  gameState,
  loading,
  maxAttempts,
  sessionId,
  sessionReady,
  user,
}: Readonly<GameStateProviderProperties>) {
  const currentAttempt = attempts.length + 1 + baseAttemptCount;
  const revealLevel = Math.min(currentAttempt, maxAttempts);

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

  // useMemo prevents a new context value object on every render —
  // without it, all useGameState() consumers re-render even when nothing changed.
  const value = useMemo<GameStateContextType>(
    () => ({
      ...toRevealValues(clues),
      attempts,
      authReady,
      blurLevel,
      clues,
      currentAttempt,
      dailyPerfume,
      gameState,
      loading,
      maxAttempts,
      potentialScore,
      revealLevel,
      sessionId,
      sessionReady,
      user,
      xsolveScore: dailyPerfume.xsolve,
    }),
    [
      attempts,
      authReady,
      blurLevel,
      clues,
      currentAttempt,
      dailyPerfume,
      gameState,
      loading,
      maxAttempts,
      potentialScore,
      revealLevel,
      sessionId,
      sessionReady,
      user,
    ],
  );

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
