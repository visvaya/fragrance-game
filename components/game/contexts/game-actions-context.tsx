"use client";

import {
  createContext,
  useContext,
  useCallback,
  // eslint-disable-next-line no-restricted-imports -- cleanup: rate-limit timer cleanup on unmount
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useWebHaptics } from "web-haptics/react";

import {
  initializeAndGuess,
  initializeAndSkip,
  initializeGame,
  resetGame,
  skipAttempt,
  submitGuess,
  type SubmitGuessResult,
  type SkipAttemptResult,
} from "@/app/actions/game-actions";
import { GENERIC_PLACEHOLDER, MASK_CHAR } from "@/lib/constants";
import { revealLetters } from "@/lib/game/scoring";

import type { Attempt } from "./game-state-context";

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
  isRateLimited: boolean;
  makeGuess: (
    perfumeName: string,
    brand: string,
    perfumeId: string,
  ) => Promise<void>;
  resetGame: () => Promise<void>;
  skipAttempt: () => Promise<void>;
};

const GameActionsContext = createContext<GameActionsContextType | undefined>(
  undefined,
);

type GameActionsProviderProperties = {
  // State from parent
  attempts: Attempt[];
  /** True once anonymous auth JWT is ready — enables lazy startGame on first action */
  authReady?: boolean;
  /** Attempt count inherited from an anonymous session (declined migration). */
  baseAttemptCount?: number;
  /** Challenge ID needed for lazy startGame on first guess/skip */
  challengeId?: string | null;
  children: ReactNode;
  dailyPerfume: DailyPerfume;
  gameState: GameState;
  // Helper flags
  isBrandRevealed: boolean;
  isYearRevealed: boolean;
  maxAttempts: number;
  nonce: string;
  sessionId: string | null;
  // State setters from parent
  setAttempts: Dispatch<SetStateAction<Attempt[]>>;
  setBaseAttemptCount: Dispatch<SetStateAction<number>>;
  setDailyPerfume: Dispatch<SetStateAction<DailyPerfume>>;
  setDiscoveredPerfumers: Dispatch<SetStateAction<Set<string>>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setImageUrl: Dispatch<SetStateAction<string>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setNonce: Dispatch<SetStateAction<string>>;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  setSessionReady?: Dispatch<SetStateAction<boolean>>;
};

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Rate limit exceeded");
}

/** Default no-op for the optional setSessionReady prop. */
function defaultSetSessionReady(_value: SetStateAction<boolean>): void {
  // intentional no-op: caller did not provide a setter
}

/**
 * Reads and clears the inherited attempt count stored in sessionStorage
 * when a player declined anonymous session migration.
 */
function readAndClearInheritedCount(): number {
  const stored = sessionStorage.getItem("eauxle_declined_anon_attempts");
  if (stored !== null) sessionStorage.removeItem("eauxle_declined_anon_attempts");
  const parsed = Number.parseInt(stored ?? "0", 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/**
 * Resolves a guess: submits to an existing session, or lazily creates a session
 * and submits in one roundtrip (Gate 6 deferred startGame).
 * On lazy init path also updates sessionId, nonce, imageUrl, and sessionReady.
 */
async function resolveGuess(
  sessionId: string | null,
  challengeId: string | null,
  perfumeId: string,
  nonce: string,
  setSessionId: Dispatch<SetStateAction<string | null>>,
  setNonce: Dispatch<SetStateAction<string>>,
  setImageUrl: Dispatch<SetStateAction<string>>,
  setSessionReady: Dispatch<SetStateAction<boolean>>,
): Promise<SubmitGuessResult> {
  if (sessionId) return submitGuess(sessionId, perfumeId, nonce);
  if (!challengeId) throw new Error("challengeId missing for lazy game init");
  const init = await initializeAndGuess(challengeId, perfumeId, readAndClearInheritedCount());
  setSessionId(init.sessionId);
  setNonce(init.nonce);
  if (init.imageUrl) setImageUrl(init.imageUrl);
  setSessionReady(true);
  return init.guessResult;
}

/**
 * Resolves a skip: skips in an existing session, or lazily creates a session
 * and skips in one roundtrip (Gate 6 deferred startGame).
 * On lazy init path also updates sessionId, nonce, imageUrl, and sessionReady.
 */
async function resolveSkip(
  sessionId: string | null,
  challengeId: string | null,
  nonce: string,
  setSessionId: Dispatch<SetStateAction<string | null>>,
  setNonce: Dispatch<SetStateAction<string>>,
  setImageUrl: Dispatch<SetStateAction<string>>,
  setSessionReady: Dispatch<SetStateAction<boolean>>,
): Promise<SkipAttemptResult> {
  if (sessionId) return skipAttempt(sessionId, nonce);
  if (!challengeId) throw new Error("challengeId missing for lazy game init");
  const init = await initializeAndSkip(challengeId, readAndClearInheritedCount());
  setSessionId(init.sessionId);
  setNonce(init.nonce);
  if (init.imageUrl) setImageUrl(init.imageUrl);
  setSessionReady(true);
  return { ...init.skipResult, imageUrl: init.imageUrl, newNonce: init.nonce };
}

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
      ? GENERIC_PLACEHOLDER.repeat(3)
      : revealLetters(targetBrand, brandPercentages[Math.min(level - 1, 5)]);

  // Year
  const guessMaskedYear = (() => {
    if (targetYear === 0 || targetYear === "") return MASK_CHAR.repeat(4);
    const yearString = targetYear.toString();
    if (level >= 5) return yearString;
    switch (level) {
      case 4: {
        return yearString.slice(0, 3) + MASK_CHAR;
      }
      case 3: {
        return yearString.slice(0, 2) + MASK_CHAR.repeat(2);
      }
      case 2: {
        return yearString.slice(0, 1) + MASK_CHAR.repeat(3);
      }
      default: {
        return MASK_CHAR.repeat(4);
      }
    }
  })();

  return { guessMaskedBrand, guessMaskedYear };
}

/**
 * GameActionsProvider - Manages game mutation operations
 * Isolated to prevent re-renders when state changes
 */
export function GameActionsProvider({
  attempts,
  authReady = false,
  baseAttemptCount = 0,
  challengeId = null,
  children,
  dailyPerfume,
  gameState,
  isBrandRevealed,
  isYearRevealed,
  maxAttempts,
  nonce,
  sessionId,
  setAttempts,
  setBaseAttemptCount,
  setDailyPerfume,
  setDiscoveredPerfumers,
  setGameState,
  setImageUrl,
  setLoading,
  setNonce,
  setSessionId,
  setSessionReady = defaultSetSessionReady,
}: Readonly<GameActionsProviderProperties>) {
  /** Synchronous guard preventing concurrent server action calls (skip/guess). */
  const isProcessingReference = useRef(false);
  const haptic = useWebHaptics();
  const t = useTranslations("GameActions");
  const [isRateLimited, setIsRateLimited] = useState(false);
  const rateLimitTimerReference = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (rateLimitTimerReference.current) clearTimeout(rateLimitTimerReference.current);
    };
  }, []);

  /** Shows a rate-limit toast and briefly locks the UI (5 s). */
  const handleRateLimit = useCallback(() => {
    toast.warning(t("rateLimitError"));
    setIsRateLimited(true);
    if (rateLimitTimerReference.current) clearTimeout(rateLimitTimerReference.current);
    rateLimitTimerReference.current = setTimeout(() => setIsRateLimited(false), 60_000);
  }, [t]);

  const makeGuess = useCallback(
    async (perfumeName: string, brand: string, perfumeId: string) => {
      if (
        isProcessingReference.current ||
        gameState !== "playing" ||
        attempts.length + baseAttemptCount >= maxAttempts ||
        !authReady
      )
        return;

      isProcessingReference.current = true;
      setLoading(true);
      try {
        const result = await resolveGuess(
          sessionId, challengeId, perfumeId, nonce,
          setSessionId, setNonce, setImageUrl, setSessionReady,
        );

        if (result.gameStatus === "won") {
          void haptic.trigger("success");
        } else if (result.gameStatus === "lost") {
          void haptic.trigger("heavy");
        } else {
          void haptic.trigger("error");
        }

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

        const nextAttemptsCount = attempts.length + 1 + baseAttemptCount;

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
          hasGuessedNotes: result.hasGuessedNotes,
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
        } else if (
          result.gameStatus === "lost" ||
          attempts.length + 1 + baseAttemptCount >= maxAttempts
        ) {
          setGameState("lost");
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          handleRateLimit();
        } else {
          console.error("Guess submission failed:", error);
        }
      } finally {
        isProcessingReference.current = false;
        setLoading(false);
      }
    },
    [
      attempts,
      authReady,
      baseAttemptCount,
      challengeId,
      gameState,
      haptic,
      maxAttempts,
      sessionId,
      nonce,
      dailyPerfume,
      isBrandRevealed,
      isYearRevealed,
      handleRateLimit,
      setAttempts,
      setGameState,
      setImageUrl,
      setLoading,
      setNonce,
      setSessionId,
      setSessionReady,
      setDailyPerfume,
    ],
  );

  const handleSkip = useCallback(async () => {
    if (
      isProcessingReference.current ||
      gameState !== "playing" ||
      attempts.length + baseAttemptCount >= maxAttempts ||
      !authReady
    )
      return;

    isProcessingReference.current = true;
    setLoading(true);
    try {
      void haptic.trigger("light");

      const result = await resolveSkip(
        sessionId, challengeId, nonce,
        setSessionId, setNonce, setImageUrl, setSessionReady,
      );
      if (result.newNonce) setNonce(result.newNonce);
      if (result.imageUrl) setImageUrl(result.imageUrl);

      setAttempts((previous) => [
        ...previous,
        {
          brand: "",
          feedback: {
            brandMatch: false,
            notesMatch: 0,
            perfumerMatch: "none",
            yearDirection: "equal",
            yearMatch: "wrong",
          },
          guess: "",
          isCorrect: false,
          isSkipped: true,
        },
      ]);

      if (result.gameStatus === "lost") {
        if (result.answerName) {
          setDailyPerfume((previous) => ({
            ...previous,
            concentration: result.answerConcentration,
            name: result.answerName ?? "",
          }));
        }
        setGameState("lost");
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        handleRateLimit();
      } else {
        console.error("Skip failed:", error);
      }
    } finally {
      isProcessingReference.current = false;
      setLoading(false);
    }
  }, [
    attempts,
    authReady,
    baseAttemptCount,
    challengeId,
    gameState,
    haptic,
    maxAttempts,
    nonce,
    sessionId,
    handleRateLimit,
    setAttempts,
    setDailyPerfume,
    setGameState,
    setImageUrl,
    setLoading,
    setNonce,
    setSessionId,
    setSessionReady,
  ]);

  const handleReset = useCallback(async () => {
    if (!sessionId) {
      console.warn("[GameProvider] No session to reset");
      return;
    }

    try {
      setLoading(true);
      const result = await resetGame(sessionId);

      if (result.success) {
        // Clear all local state (including inherited anon attempt count)
        setAttempts([]);
        setBaseAttemptCount(0);
        setGameState("playing");
        setNonce("");
        setSessionId(null);
        setDailyPerfume({
          brand: GENERIC_PLACEHOLDER.repeat(5),
          concentration: undefined,
          gender: GENERIC_PLACEHOLDER.repeat(5),
          id: "skeleton",
          imageUrl: "/placeholder.svg?height=400&width=400",
          isLinear: false,
          name: GENERIC_PLACEHOLDER.repeat(5),
          notes: {
            base: [
              GENERIC_PLACEHOLDER.repeat(5),
              GENERIC_PLACEHOLDER.repeat(5),
              GENERIC_PLACEHOLDER.repeat(5),
            ],
            heart: [
              GENERIC_PLACEHOLDER.repeat(5),
              GENERIC_PLACEHOLDER.repeat(5),
              GENERIC_PLACEHOLDER.repeat(5),
            ],
            top: [
              GENERIC_PLACEHOLDER.repeat(5),
              GENERIC_PLACEHOLDER.repeat(5),
              GENERIC_PLACEHOLDER.repeat(5),
            ],
          },
          perfumer: GENERIC_PLACEHOLDER.repeat(5),
          xsolve: 0 as number,
          year: MASK_CHAR.repeat(4) as string | number,
        });
        setImageUrl("/placeholder.svg");
        setDiscoveredPerfumers(new Set());

        // Allow React to process state clear
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Reinitialize game
        const { challenge, session } = await initializeGame();

        if (challenge && session) {
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

          setSessionId(session.sessionId);
          setNonce(session.nonce);

          const busterUrl = session.imageUrl
            ? // eslint-disable-next-line unicorn/prefer-date-now -- Date.now() is blocked by no-restricted-properties; getTime() is equivalent and avoids the restricted static method
              `${session.imageUrl}?reset=${new Date().getTime()}`
            : "/placeholder.svg";
          setImageUrl(busterUrl);
        }
      } else {
        console.error("[GameProvider] Reset backend action failed.");
      }
      setLoading(false);
    } catch (error) {
      console.error("[GameProvider] Reset failed with error:", error);
      setLoading(false);
    }
  }, [
    sessionId,
    setLoading,
    setAttempts,
    setBaseAttemptCount,
    setGameState,
    setNonce,
    setSessionId,
    setDailyPerfume,
    setImageUrl,
    setDiscoveredPerfumers,
  ]);

  // useMemo prevents a new context value object on every render —
  // without it, all useGameActions() consumers re-render even when nothing changed.
  const value = useMemo(
    () => ({
      isRateLimited,
      makeGuess,
      resetGame: handleReset,
      skipAttempt: handleSkip,
    }),
    [isRateLimited, makeGuess, handleReset, handleSkip],
  );

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
