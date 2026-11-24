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
import type {
  Attempt,
  GameSessionAction,
  GameState,
} from "@/lib/game/game-session-state";
import { isRateLimitError } from "@/lib/rate-limit-error";

type GameActionsContextType = {
  isRateLimited: boolean;
  makeGuess: (
    perfumeName: string,
    brand: string,
    perfumeId: string,
  ) => Promise<void>;
  resetGame: () => Promise<void>;
  /** Fetches the daily challenge again after the start-up could not load it. */
  retryStart: () => Promise<void>;
  skipAttempt: () => Promise<void>;
};

const GameActionsContext = createContext<GameActionsContextType | undefined>(
  undefined,
);

type GameActionsProviderProperties = {
  // State from parent
  attempts: Attempt[];
  /** True once anonymous auth JWT is ready – enables lazy startGame on first action */
  authReady?: boolean;
  /** Challenge ID needed for lazy startGame on first guess/skip */
  challengeId?: string | null;
  children: ReactNode;
  /** Applies the outcome of a guess, skip or reset to the game session state. */
  dispatch: Dispatch<GameSessionAction>;
  gameState: GameState;
  maxAttempts: number;
  nonce: string;
  /** Fetches the daily challenge again after the start-up could not load it. */
  retryStart: () => Promise<void>;
  sessionId: string | null;
  setLoading: Dispatch<SetStateAction<boolean>>;
};

/** Error haptic after a wrong or skipped attempt, with a second heavy pulse when it ended the game. */
function triggerWrongAttemptHaptics(
  haptic: ReturnType<typeof useWebHaptics>,
  gameStatus: string,
) {
  void haptic.trigger("error");
  if (gameStatus === "lost") {
    setTimeout(() => void haptic.trigger("heavy"), 180);
  }
}

/** A session created together with the first move (Gate 6 deferred startGame). */
type StartedSession = Extract<
  GameSessionAction,
  { type: "lazySessionStarted" }
>["session"];

/**
 * Resolves a guess: submits to an existing session, or lazily creates a session
 * and submits in one roundtrip (Gate 6 deferred startGame).
 * On the lazy path also returns the new session for the caller to store.
 */
async function resolveGuess(
  sessionId: string | null,
  challengeId: string | null,
  perfumeId: string,
  nonce: string,
): Promise<{ result: SubmitGuessResult; startedSession?: StartedSession }> {
  if (sessionId)
    return { result: await submitGuess(sessionId, perfumeId, nonce) };
  if (!challengeId) throw new Error("challengeId missing for lazy game init");
  const init = await initializeAndGuess(challengeId, perfumeId);
  return { result: init.guessResult, startedSession: init };
}

/**
 * Resolves a skip: skips in an existing session, or lazily creates a session
 * and skips in one roundtrip (Gate 6 deferred startGame).
 * On the lazy path also returns the new session for the caller to store.
 */
async function resolveSkip(
  sessionId: string | null,
  challengeId: string | null,
  nonce: string,
): Promise<{ result: SkipAttemptResult; startedSession?: StartedSession }> {
  if (sessionId) return { result: await skipAttempt(sessionId, nonce) };
  if (!challengeId) throw new Error("challengeId missing for lazy game init");
  const init = await initializeAndSkip(challengeId);
  return {
    result: {
      ...init.skipResult,
      imageUrl: init.imageUrl,
      newNonce: init.nonce,
    },
    startedSession: init,
  };
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
  dispatch,
  gameState,
  maxAttempts,
  nonce,
  retryStart,
  sessionId,
  setLoading,
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

  /** Rate-limit errors lock the UI; anything else is logged and shown as a network error. */
  const reportActionError = useCallback(
    (error: unknown, logMessage: string) => {
      if (isRateLimitError(error)) {
        handleRateLimit();
      } else {
        console.error(logMessage, error);
        toast.error(t("networkError"));
      }
    },
    [handleRateLimit, t],
  );

  /** Takes the processing lock and shows loading; false when no move is allowed now. */
  const beginAction = useCallback(() => {
    if (
      isProcessingReference.current ||
      gameState !== "playing" ||
      attempts.length >= maxAttempts ||
      !authReady
    )
      return false;
    isProcessingReference.current = true;
    setLoading(true);
    return true;
  }, [attempts, authReady, gameState, maxAttempts, setLoading]);

  const makeGuess = useCallback(
    async (perfumeName: string, brand: string, perfumeId: string) => {
      if (!beginAction()) return;
      try {
        const { result, startedSession } = await resolveGuess(
          sessionId,
          challengeId,
          perfumeId,
          nonce,
        );
        if (startedSession)
          dispatch({ session: startedSession, type: "lazySessionStarted" });
        dispatch({
          guess: { brand, perfumeId, perfumeName },
          result,
          type: "guessResolved",
        });

        // Fire haptic synced with row highlight (after the attempt is dispatched, not before)
        if (result.gameStatus === "won") {
          void haptic.trigger("success");
          setTimeout(() => void haptic.trigger("success"), 220);
        } else {
          triggerWrongAttemptHaptics(haptic, result.gameStatus);
        }
      } catch (error) {
        reportActionError(error, "Guess submission failed:");
      } finally {
        isProcessingReference.current = false;
        setLoading(false);
      }
    },
    [
      beginAction,
      challengeId,
      dispatch,
      haptic,
      sessionId,
      nonce,
      reportActionError,
      setLoading,
    ],
  );

  const handleSkip = useCallback(async () => {
    if (!beginAction()) return;
    try {
      const { result, startedSession } = await resolveSkip(
        sessionId,
        challengeId,
        nonce,
      );
      if (startedSession)
        dispatch({ session: startedSession, type: "lazySessionStarted" });
      dispatch({ result, type: "skipResolved" });

      // Same haptic as a wrong guess, synced with the row highlight
      triggerWrongAttemptHaptics(haptic, result.gameStatus);
    } catch (error) {
      reportActionError(error, "Skip failed:");
    } finally {
      isProcessingReference.current = false;
      setLoading(false);
    }
  }, [
    beginAction,
    challengeId,
    dispatch,
    haptic,
    nonce,
    sessionId,
    reportActionError,
    setLoading,
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
        dispatch({ type: "resetCleared" });

        // Allow React to process state clear
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Reinitialize game
        const { challenge, session } = await initializeGame();

        if (challenge && session)
          dispatch({ challenge, session, type: "resetReloaded" });
      } else {
        console.error("[GameProvider] Reset backend action failed.");
      }
      setLoading(false);
    } catch (error) {
      console.error("[GameProvider] Reset failed with error:", error);
      setLoading(false);
    }
  }, [dispatch, sessionId, setLoading]);

  // useMemo prevents a new context value object on every render –
  // without it, all useGameActions() consumers re-render even when nothing changed.
  const value = useMemo(
    () => ({
      isRateLimited,
      makeGuess,
      resetGame: handleReset,
      retryStart,
      skipAttempt: handleSkip,
    }),
    [isRateLimited, makeGuess, handleReset, handleSkip, retryStart],
  );

  // jscpd:ignore-start -- each context has its own provider value and error message and changes independently
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
// jscpd:ignore-end
