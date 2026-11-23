"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { RevealedClues } from "@/lib/game/clue-reveal";
import type {
  Attempt,
  DailyPerfume,
  GameState,
} from "@/lib/game/game-session-state";
import type { User } from "@supabase/supabase-js";

export type {
  Attempt,
  DailyPerfume,
  GameState,
} from "@/lib/game/game-session-state";

/** Maps server clues to the reveal values exposed by useGameState(). */
function toRevealValues(clues: RevealedClues) {
  return {
    isGenderRevealed: clues.genderRevealed,
    revealedBrand: clues.brand,
    revealedPerfumer: clues.perfumer,
    revealedYear: clues.year,
  };
}

type GameStateContextType = {
  // Core state
  attempts: Attempt[];
  /** True when the anonymous sign-in gave up; a guess queued for it is dropped. */
  authFailed: boolean;
  /** True once anonymous auth JWT is ready – guards lazy startGame in game-actions-context */
  authReady: boolean;
  blurLevel: number;
  /** Clues computed on the server for the current progress. */
  clues: RevealedClues;
  currentAttempt: number;
  dailyPerfume: DailyPerfume;
  gameState: GameState;
  // Boolean flags (derived)
  isGenderRevealed: boolean;
  loading: boolean;

  maxAttempts: number;
  potentialScore: number;
  revealedBrand: string;

  revealedPerfumer: string;
  revealedYear: string;
  revealLevel: number;
  sessionId: string | null;
  sessionReady: boolean;
  user: User | null;
  xsolveScore: number;
};

const GameStateContext = createContext<GameStateContextType | undefined>(
  undefined,
);

type GameStateProviderProperties = {
  // State from parent orchestrator
  attempts: Attempt[];
  /** True when the anonymous sign-in gave up. */
  authFailed?: boolean;
  /** True once anonymous auth JWT is ready – guards lazy startGame in game-actions-context */
  authReady?: boolean;
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
  authFailed = false,
  authReady = false,
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
  const currentAttempt = attempts.length + 1;
  const revealLevel = Math.min(currentAttempt, maxAttempts);

  /**
   * blurLevel - Simple array lookup
   * Controls image blur effect
   */
  const blurLevel = useMemo(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver) return 0;
    const blurLevels = [10, 9.5, 8.5, 7.5, 6, 0];
    return blurLevels[Math.min(revealLevel - 1, 5)] ?? 0;
  }, [revealLevel, gameState]);

  /**
   * potentialScore - Simple array lookup
   * Shows points available for current attempt
   */
  const potentialScore = useMemo(() => {
    const baseScores = [1000, 700, 490, 343, 240, 168];
    return baseScores[Math.min(currentAttempt - 1, 5)] ?? 0;
  }, [currentAttempt]);

  // useMemo prevents a new context value object on every render –
  // without it, all useGameState() consumers re-render even when nothing changed.
  const value = useMemo<GameStateContextType>(
    () => ({
      ...toRevealValues(clues),
      attempts,
      authFailed,
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
      authFailed,
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

  // jscpd:ignore-start -- each context has its own provider value and error message and changes independently
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
// jscpd:ignore-end
