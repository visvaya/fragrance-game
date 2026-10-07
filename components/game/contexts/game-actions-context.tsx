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
import { HIDDEN_CLUES, type RevealedClues } from "@/lib/game/clue-reveal";

import { SKELETON_PERFUME } from "./skeleton-perfume";

import type { Attempt, DailyPerfume } from "./game-state-context";

type GameState = "playing" | "won" | "lost";

const SKIPPED_ATTEMPT: Attempt = {
  brand: "",
  feedback: {
    brandMatch: false,
    genderMatch: false,
    notesMatch: 0,
    perfumerMatch: "none",
    yearDirection: "equal",
    yearMatch: "wrong",
  },
  guess: "",
  isCorrect: false,
  isSkipped: true,
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
  /** Challenge ID needed for lazy startGame on first guess/skip */
  challengeId?: string | null;
  children: ReactNode;
  gameState: GameState;
  maxAttempts: number;
  nonce: string;
  sessionId: string | null;
  // State setters from parent
  setAttempts: Dispatch<SetStateAction<Attempt[]>>;
  setClues: Dispatch<SetStateAction<RevealedClues>>;
  setDailyPerfume: Dispatch<SetStateAction<DailyPerfume>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setImageUrl: Dispatch<SetStateAction<string>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setNonce: Dispatch<SetStateAction<string>>;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  setSessionReady?: Dispatch<SetStateAction<boolean>>;
};

function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.startsWith("Rate limit exceeded")
  );
}

/** Default no-op for the optional setSessionReady prop. */
function defaultSetSessionReady(_value: SetStateAction<boolean>): void {
  // intentional no-op: caller did not provide a setter
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
  const init = await initializeAndGuess(challengeId, perfumeId);
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
  const init = await initializeAndSkip(challengeId);
  setSessionId(init.sessionId);
  setNonce(init.nonce);
  if (init.imageUrl) setImageUrl(init.imageUrl);
  setSessionReady(true);
  return { ...init.skipResult, imageUrl: init.imageUrl, newNonce: init.nonce };
}

/**
 * GameActionsProvider - Manages game mutation operations
 * Isolated to prevent re-renders when state changes
 */
export function GameActionsProvider({
  attempts,
  authReady = false,
  challengeId = null,
  children,
  gameState,
  maxAttempts,
  nonce,
  sessionId,
  setAttempts,
  setClues,
  setDailyPerfume,
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
  const rateLimitTimerReference = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (rateLimitTimerReference.current)
        clearTimeout(rateLimitTimerReference.current);
    };
  }, []);

  /** Shows a rate-limit toast and briefly locks the UI (5 s). */
  const handleRateLimit = useCallback(() => {
    toast.warning(t("rateLimitError"));
    setIsRateLimited(true);
    if (rateLimitTimerReference.current)
      clearTimeout(rateLimitTimerReference.current);
    rateLimitTimerReference.current = setTimeout(
      () => setIsRateLimited(false),
      60_000,
    );
  }, [t]);

  const makeGuess = useCallback(
    async (perfumeName: string, brand: string, perfumeId: string) => {
      if (
        isProcessingReference.current ||
        gameState !== "playing" ||
        attempts.length >= maxAttempts ||
        !authReady
      )
        return;

      isProcessingReference.current = true;
      setLoading(true);
      try {
        const result = await resolveGuess(
          sessionId,
          challengeId,
          perfumeId,
          nonce,
          setSessionId,
          setNonce,
          setImageUrl,
          setSessionReady,
        );

        if (result.imageUrl) {
          setImageUrl(result.imageUrl);
        }

        if (result.newNonce) {
          setNonce(result.newNonce);
        }

        const newAttempt: Attempt = {
          brand,
          concentration: result.guessedPerfumeDetails?.concentration,
          feedback: result.feedback,
          gender: result.guessedPerfumeDetails?.gender,
          guess: perfumeName,
          hasGuessedNotes: result.hasGuessedNotes,
          isCorrect: result.result === "correct",
          perfumeId: perfumeId,
          perfumers: result.guessedPerfumers,
          year: result.guessedPerfumeDetails?.year,
        };

        setAttempts((previous) => [...previous, newAttempt]);
        setClues(result.revealed);

        // Fire haptic synced with row highlight (after setAttempts, not before)
        if (result.gameStatus === "won") {
          void haptic.trigger("success");
          setTimeout(() => void haptic.trigger("success"), 220);
        } else if (result.gameStatus === "lost") {
          void haptic.trigger("error");
          setTimeout(() => void haptic.trigger("heavy"), 180);
        } else {
          void haptic.trigger("error");
        }

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
          attempts.length + 1 >= maxAttempts
        ) {
          setGameState("lost");
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          handleRateLimit();
        } else {
          console.error("Guess submission failed:", error);
          toast.error(t("networkError"));
        }
      } finally {
        isProcessingReference.current = false;
        setLoading(false);
      }
    },
    [
      attempts,
      authReady,
      challengeId,
      gameState,
      haptic,
      maxAttempts,
      sessionId,
      nonce,
      handleRateLimit,
      setAttempts,
      setClues,
      setGameState,
      setImageUrl,
      setLoading,
      setNonce,
      setSessionId,
      setSessionReady,
      setDailyPerfume,
      t,
    ],
  );

  const handleSkip = useCallback(async () => {
    if (
      isProcessingReference.current ||
      gameState !== "playing" ||
      attempts.length >= maxAttempts ||
      !authReady
    )
      return;

    isProcessingReference.current = true;
    setLoading(true);
    try {
      const result = await resolveSkip(
        sessionId,
        challengeId,
        nonce,
        setSessionId,
        setNonce,
        setImageUrl,
        setSessionReady,
      );
      if (result.newNonce) setNonce(result.newNonce);
      if (result.imageUrl) setImageUrl(result.imageUrl);

      setAttempts((previous) => [...previous, SKIPPED_ATTEMPT]);
      setClues(result.revealed);

      if (result.gameStatus === "lost") {
        // Game over — stronger double-pulse haptic synced with row highlight + lost state
        void haptic.trigger("error");
        setTimeout(() => void haptic.trigger("heavy"), 180);
        if (result.answerName) {
          setDailyPerfume((previous) => ({
            ...previous,
            concentration: result.answerConcentration,
            name: result.answerName ?? "",
          }));
        }
        setGameState("lost");
      } else {
        // Wrong/skipped attempt — same haptic as wrong guess, synced with row highlight
        void haptic.trigger("error");
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        handleRateLimit();
      } else {
        console.error("Skip failed:", error);
        toast.error(t("networkError"));
      }
    } finally {
      isProcessingReference.current = false;
      setLoading(false);
    }
  }, [
    attempts,
    authReady,
    challengeId,
    gameState,
    haptic,
    maxAttempts,
    nonce,
    sessionId,
    handleRateLimit,
    setAttempts,
    setClues,
    setDailyPerfume,
    setGameState,
    setImageUrl,
    setLoading,
    setNonce,
    setSessionId,
    setSessionReady,
    t,
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
        // Clear all local state
        setAttempts([]);
        setGameState("playing");
        setNonce("");
        setSessionId(null);
        setDailyPerfume(SKELETON_PERFUME);
        setClues(HIDDEN_CLUES);
        setImageUrl("/placeholder.svg");

        // Allow React to process state clear
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Reinitialize game
        const { challenge, session } = await initializeGame();

        if (challenge && session) {
          setDailyPerfume({
            concentration: undefined,
            id: "daily",
            imageUrl: "/placeholder.svg",
            name: "Mystery Perfume",
            xsolve: challenge.xsolve,
          });
          setClues(session.revealed);

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
    setGameState,
    setNonce,
    setSessionId,
    setClues,
    setDailyPerfume,
    setImageUrl,
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
