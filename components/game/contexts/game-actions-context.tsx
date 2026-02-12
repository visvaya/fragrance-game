"use client";

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  initializeGame,
  resetGame,
  submitGuess,
} from "@/app/actions/game-actions";
import { revealLetters } from "@/lib/game/scoring";

import type { Attempt } from "./game-state-context";
import type { PostHog } from "posthog-js";

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

type GameActionsContextType = {
  makeGuess: (
    perfumeName: string,
    brand: string,
    perfumeId: string,
  ) => Promise<void>;
  resetGame: () => Promise<void>;
};

const GameActionsContext = createContext<GameActionsContextType | undefined>(
  undefined,
);

type GameActionsProviderProperties = {
  // State from parent
  attempts: Attempt[];
  children: ReactNode;
  dailyPerfume: DailyPerfume;
  gameState: GameState;
  // Helper flags
  isBrandRevealed: boolean;
  isYearRevealed: boolean;
  maxAttempts: number;
  nonce: string;
  // PostHog for analytics
  posthog: PostHog | null;
  sessionId: string | null;
  // State setters from parent
  setAttempts: Dispatch<SetStateAction<Attempt[]>>;
  setDailyPerfume: Dispatch<SetStateAction<DailyPerfume>>;
  setDiscoveredPerfumers: Dispatch<SetStateAction<Set<string>>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setImageUrl: Dispatch<SetStateAction<string>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setNonce: Dispatch<SetStateAction<string>>;
  setSessionId: Dispatch<SetStateAction<string | null>>;
};

/**
 * Helper function to calculate masked values for snapshots
 * Extracted from game-provider for DRY
 */
function calculateMaskedValues(
  level: number,
  targetBrand: string,
  targetYear: number | string,
) {
  // Brand
  const brandPercentages = [0, 0, 0.15, 0.4, 0.7, 1];
  const guessMaskedBrand =
    level === 1
      ? "?????"
      : revealLetters(targetBrand, brandPercentages[Math.min(level - 1, 5)]);

  // Year
  let guessMaskedYear = "____";
  if (targetYear) {
    const yearString = targetYear.toString();
    if (level >= 5) guessMaskedYear = yearString;
    else
      switch (level) {
        case 4: {
          guessMaskedYear = yearString.slice(0, 3) + "_";
          break;
        }
        case 3: {
          guessMaskedYear = yearString.slice(0, 2) + "__";
          break;
        }
        case 2: {
          {
            guessMaskedYear = yearString.slice(0, 1) + "___";
            // No default
          }
          break;
        }
      }
  }

  return { guessMaskedBrand, guessMaskedYear };
}

/**
 * GameActionsProvider - Manages game mutation operations
 * Isolated to prevent re-renders when state changes
 */
export function GameActionsProvider({
  attempts,
  children,
  dailyPerfume,
  gameState,
  isBrandRevealed,
  isYearRevealed,
  maxAttempts,
  nonce,
  posthog: _posthog,
  sessionId,
  setAttempts,
  setDailyPerfume,
  setDiscoveredPerfumers,
  setGameState,
  setImageUrl,
  setLoading,
  setNonce,
  setSessionId,
}: Readonly<GameActionsProviderProperties>) {
  const makeGuess = useCallback(
    async (perfumeName: string, brand: string, perfumeId: string) => {
      if (
        gameState !== "playing" ||
        attempts.length >= maxAttempts ||
        !sessionId
      )
        return;

      try {
        const result = await submitGuess(sessionId, perfumeId, nonce);

        if (result.imageUrl) {
          setImageUrl(result.imageUrl);
        }

        if (result.newNonce) {
          setNonce(result.newNonce);
        }

        const feedback = result.feedback;

        // Calculate snapshot state
        const thisBrandRevealed =
          brand.toLowerCase() === dailyPerfume.brand.toLowerCase();
        const thisYearRevealed =
          String(result.guessedPerfumeDetails?.year ?? "") ===
          String(dailyPerfume.year);

        const wasGenderRevealed = attempts.some((a) => {
          return a.snapshot?.genderRevealed;
        });

        const nextAttemptsCount = attempts.length + 1;

        const { guessMaskedBrand, guessMaskedYear } = calculateMaskedValues(
          nextAttemptsCount,
          brand,
          result.guessedPerfumeDetails?.year ?? 0,
        );

        const {
          guessMaskedBrand: answerClueBrand,
          guessMaskedYear: answerClueYear,
        } = calculateMaskedValues(
          nextAttemptsCount,
          dailyPerfume.brand,
          dailyPerfume.year,
        );

        const brandRevealedByLevel = answerClueBrand === dailyPerfume.brand;
        const yearRevealedByLevel =
          answerClueYear === dailyPerfume.year.toString();

        const guessGender = result.guessedPerfumeDetails?.gender;
        const matchedGender =
          guessGender?.toLowerCase() === dailyPerfume.gender.toLowerCase();

        const newSnapshot = {
          brandRevealed:
            isBrandRevealed || thisBrandRevealed || brandRevealedByLevel,
          genderRevealed: wasGenderRevealed || matchedGender,
          guessMaskedBrand,
          guessMaskedYear,
          yearRevealed:
            isYearRevealed || thisYearRevealed || yearRevealedByLevel,
        };

        const newAttempt: Attempt = {
          brand,
          concentration: result.guessedPerfumeDetails?.concentration,
          feedback,
          gender: result.guessedPerfumeDetails?.gender,
          guess: perfumeName,
          isCorrect: result.result === "correct",
          perfumeId: perfumeId,
          perfumers: result.guessedPerfumers,
          snapshot: newSnapshot,
          year: result.guessedPerfumeDetails?.year,
        };

        setAttempts((previous) => [...previous, newAttempt]);

        if (result.answerName) {
          const answerName = result.answerName;
          const answerConcentration = result.answerConcentration;
          setDailyPerfume((previous) => ({
            ...previous,
            concentration: answerConcentration,
            name: answerName,
          }));
        }

        if (result.gameStatus === "won") {
          setGameState("won");
          if (result.imageUrl) {
            setImageUrl(result.imageUrl);
          }
        } else if (attempts.length + 1 >= maxAttempts) {
          setGameState("lost");
        }
      } catch (error) {
        console.error("Guess submission failed:", error);
      }
    },
    [
      attempts,
      gameState,
      maxAttempts,
      sessionId,
      nonce,
      dailyPerfume,
      isBrandRevealed,
      isYearRevealed,
      setAttempts,
      setGameState,
      setImageUrl,
      setNonce,
      setDailyPerfume,
    ],
  );

  const handleReset = useCallback(async () => {
    if (!sessionId) {
      console.warn("[GameProvider] No session to reset");
      return;
    }

    try {
      setLoading(true);
      const result = await resetGame(sessionId);

      if (result.success) {
        // Clear all local state
        setAttempts([]);
        setGameState("playing");
        setNonce("");
        setSessionId(null);
        setDailyPerfume({
          brand: "?????" as string,
          concentration: undefined as string | undefined,
          gender: "?????",
          id: "skeleton",
          imageUrl: "/placeholder.svg?height=400&width=400",
          isLinear: false as boolean,
          name: "?????" as string,
          notes: {
            base: ["?????", "?????", "?????"],
            heart: ["?????", "?????", "?????"],
            top: ["?????", "?????", "?????"],
          },
          perfumer: "?????" as string,
          xsolve: 0 as number,
          year: "____" as string | number,
        });
        setImageUrl("/placeholder.svg");
        setDiscoveredPerfumers(new Set());

        // Allow React to process state clear
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Reinitialize game
        const { challenge, session } = await initializeGame();

        if (challenge && session) {
          if (challenge.clues) {
            setDailyPerfume({
              brand: challenge.clues.brand,
              concentration: challenge.clues.concentration,
              gender: challenge.clues.gender,
              id: "daily",
              imageUrl: "/placeholder.svg",
              isLinear: challenge.clues.isLinear,
              name: "Mystery Perfume",
              notes: challenge.clues.notes,
              perfumer: challenge.clues.perfumer,
              xsolve: challenge.clues.xsolve,
              year: challenge.clues.year,
            });
          }

          setSessionId(session.sessionId);
          setNonce(session.nonce);

          const busterUrl = session.imageUrl
            ? `${session.imageUrl}?reset=${Date.now()}`
            : "/placeholder.svg";
          setImageUrl(busterUrl);
        }
      } else {
        console.error("[GameProvider] Reset backend action failed.");
      }
    } catch (error) {
      console.error("[GameProvider] Reset failed with error:", error);
    } finally {
      setLoading(false);
    }
  }, [
    sessionId,
    setLoading,
    setAttempts,
    setGameState,
    setNonce,
    setSessionId,
    setDailyPerfume,
    setImageUrl,
    setDiscoveredPerfumers,
  ]);

  const value = {
    makeGuess,
    resetGame: handleReset,
  };

  return (
    <GameActionsContext.Provider value={value}>
      {children}
    </GameActionsContext.Provider>
  );
}

/**
 * useGameActions - Hook to access game actions
 * Use this for components that trigger mutations (input, reset button)
 */
export function useGameActions() {
  const context = useContext(GameActionsContext);
  if (!context) {
    throw new Error("useGameActions must be used within GameActionsProvider");
  }
  return context;
}
