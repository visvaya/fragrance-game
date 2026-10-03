"use client";

// eslint-disable-next-line no-restricted-imports -- subscription: onAuthStateChange listener; orchestration: async auth+challenge+session init
import { useState, useEffect, useMemo, type ReactNode } from "react";

import dynamic from "next/dynamic";

import {
  initializeGame,
  startGame,
  type DailyChallenge,
  type StartGameResponse,
} from "@/app/actions/game-actions";
import { captureAnalyticsEvent } from "@/components/providers/posthog-provider";
import { useRouter } from "@/i18n/routing";
import { GENERIC_PLACEHOLDER, MAX_GUESSES } from "@/lib/constants";
import { HIDDEN_CLUES, type RevealedClues } from "@/lib/game/clue-reveal";
import { getSupabaseClient } from "@/lib/supabase/get-client";

import {
  GameStateProvider,
  useGameState,
  GameActionsProvider,
  useGameActions,
  useUIPreferences,
  type Attempt,
  type DailyPerfume,
} from "./contexts";

import type { createClient as CreateClientType } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// Lazy-loaded modals — not needed for first render, keep them out of critical path
const MigrationModal = dynamic(
  async () =>
    import("@/components/auth/migration-modal").then((module_) => ({
      default: module_.MigrationModal,
    })),
  { ssr: false },
);
const AuthCaptchaModal = dynamic(
  async () =>
    import("@/components/auth/auth-captcha-modal").then((module_) => ({
      default: module_.AuthCaptchaModal,
    })),
  { ssr: false },
);

// Type for verifyAuthSession parameter — type-only import, zero runtime cost
type SupabaseClient = ReturnType<typeof CreateClientType>;

/**
 * Fire-and-forget: updates Sentry user identity.
 * Extracted to module level to avoid promise/no-nesting in the auth state change handler.
 */
function updateSentryUser(user: User | null): void {
  void import("@sentry/nextjs").then((s) => {
    s.setUser(user ? { id: user.id } : null);
    return null;
  });
}

// Skeleton / Default for initialization (prevents null checks everywhere)
const SKELETON_PERFUME: DailyPerfume = {
  concentration: undefined,
  id: "skeleton",
  imageUrl: "/placeholder.svg?height=400&width=400",
  name: GENERIC_PLACEHOLDER.repeat(5),
  xsolve: 0,
};

type GameState = "playing" | "won" | "lost";

/**
 * Maps the server guess history to attempts. Feedback comes from the server as is,
 * so the browser never compares guesses with the answer.
 */
function hydrateAttempts(
  guesses: StartGameResponse["guesses"] | undefined,
): Attempt[] {
  if (!guesses) return [];
  return guesses.map((g) =>
    g.isSkip
      ? {
          brand: "",
          feedback: g.feedback,
          guess: "",
          isCorrect: false,
          isSkipped: true,
        }
      : {
          brand: g.brandName,
          concentration: g.concentration,
          feedback: g.feedback,
          gender: g.gender,
          guess: g.perfumeName,
          isCorrect: g.isCorrect,
          perfumeId: g.perfumeId,
          perfumers: g.perfumers,
          year: g.year,
        },
  );
}

/**
 * Backward-compatible unified hook
 * Combines all three contexts for components not yet migrated
 */
export function useGame() {
  const state = useGameState();
  const actions = useGameActions();
  const ui = useUIPreferences();

  // Map new context values to old interface
  return {
    ...state,
    ...actions,
    ...ui,
    // Provide getter functions for backward compatibility
    getBlurLevel: () => state.blurLevel,
    getPotentialScore: () => state.potentialScore,
    getRevealedBrand: () => state.revealedBrand,
    getRevealedGender: () => state.revealedGender,
    getRevealedPerfumer: () => state.revealedPerfumer,
    getRevealedYear: () => state.revealedYear,
    getVisibleNotes: () => state.visibleNotes,
  };
}

/**
 * Polls Supabase until the session cookie is confirmed or max attempts exceeded.
 * Returns the verified user (or null) without mutating any external state.
 */
async function verifyAuthSession(
  supabase: SupabaseClient,
): Promise<{ user: User | null; verified: boolean }> {
  const maxAttempts = 3;
  for (const attempt of Array.from({ length: maxAttempts }, (_, i) => i)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return { user: session.user, verified: true };
    await new Promise((resolve) =>
      setTimeout(resolve, 50 * Math.pow(2, attempt)),
    );
  }
  return { user: null, verified: false };
}

/**
 * Fetches the daily challenge + game session using the most efficient path:
 * - SSR-provided data used directly if available (0 roundtrips)
 * - Otherwise calls initializeGame (2 roundtrips) or startGame (1 roundtrip)
 * Includes one automatic retry when challenge arrives but session fails.
 */
async function fetchChallengeAndSession(
  initialChallenge: DailyChallenge | undefined,
  initialSession: StartGameResponse | null | undefined,
  inheritedCount: number,
): Promise<{
  challenge: DailyChallenge | null;
  session: StartGameResponse | null;
}> {
  if (initialChallenge) {
    if (initialSession)
      return { challenge: initialChallenge, session: initialSession };
    const session = await startGame(initialChallenge.id, inheritedCount).catch(
      (error: unknown) => {
        console.error(
          "[GameProvider] startGame with SSR challenge failed:",
          error,
        );
        return null;
      },
    );
    return { challenge: initialChallenge, session };
  }

  const { challenge, session } = await initializeGame(inheritedCount);

  // Retry if challenge arrived but session failed (cookies not yet processed)
  if (challenge && session == null) {
    console.warn(
      "[GameProvider] Got challenge but no session. Retrying session creation...",
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const retrySession = await startGame(challenge.id, inheritedCount).catch(
      (error: unknown) => {
        console.error("[GameProvider] Retry startGame failed:", error);
        return null;
      },
    );
    return { challenge, session: retrySession };
  }
  return { challenge, session };
}

/**
 * GameProvider - Main orchestrator that manages state and coordinates contexts
 * All state lives here as single source of truth
 * Contexts receive state and setters as props
 */
export function GameProvider({
  children,
  initialChallenge,
  initialImageUrl,
  initialSession,
}: Readonly<{
  children: ReactNode;
  initialChallenge?: DailyChallenge | null;
  initialImageUrl?: string | null;
  initialSession?: StartGameResponse | null;
}>) {
  // === Core Game State (Single Source of Truth) ===
  // Lazy initializers let us synchronously populate state from initialSession on the very
  // first render — no empty-state flash, no extra useEffect re-render cycle.
  const [attempts, setAttempts] = useState<Attempt[]>(() =>
    hydrateAttempts(initialSession?.guesses),
  );
  const [gameState, setGameState] = useState<GameState>(() => {
    if (!initialSession) return "playing";
    const last = initialSession.guesses.at(-1);
    if (last?.isCorrect) return "won";
    if (initialSession.guesses.length >= MAX_GUESSES) return "lost";
    return "playing";
  });
  const [imageUrl, setImageUrl] = useState<string>(
    initialSession?.imageUrl ??
      initialImageUrl ??
      "/placeholder.svg?height=400&width=400",
  );
  const [loading, setLoading] = useState(!initialChallenge);
  const [sessionReady, setSessionReady] = useState(
    initialSession !== null && initialSession !== undefined,
  );
  /** True once anonymous auth JWT is confirmed — gates lazy startGame in game-actions-context */
  const [authReady, setAuthReady] = useState(
    initialSession !== null && initialSession !== undefined,
  );
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    initialSession?.sessionId ?? null,
  );
  const [dailyPerfume, setDailyPerfume] = useState<DailyPerfume>(
    // Use real data when initialChallenge is present (SSR-provided clues).
    // sessionReady controls interactivity — the game board is shown immediately
    // from SSR data while auth runs in the background (Gate 5 Optimistic UI).
    initialChallenge
      ? {
          concentration: initialSession?.answerConcentration,
          id: "daily",
          imageUrl: initialImageUrl ?? "/placeholder.svg?height=400&width=400",
          name: initialSession?.answerName ?? "Mystery Perfume",
          xsolve: initialChallenge.xsolve,
        }
      : SKELETON_PERFUME,
  );
  const [clues, setClues] = useState<RevealedClues>(
    initialSession?.revealed ?? initialChallenge?.revealed ?? HIDDEN_CLUES,
  );
  const [nonce, setNonce] = useState<string>(initialSession?.nonce ?? "");
  const [isCaptchaRequired, setIsCaptchaRequired] = useState(false);
  /**
   * Attempt count inherited from a declined anonymous-session migration.
   * When a player plays as anon and then declines migration, this carries over
   * their used attempts so they cannot start fresh with an informational advantage.
   */
  const [baseAttemptCount, setBaseAttemptCount] = useState(0);
  const maxAttempts = MAX_GUESSES;

  const handleCaptchaVerify = async (token: string) => {
    setIsCaptchaRequired(false);
    setLoading(true);
    // Retry init with captcha token handling - we trigger a re-run of the effect
    // But since the effect is [] dep, we'll manually retry the specific auth part here
    // or cleaner: extract the auth logic.
    // For now, let's keep it simple: try auth again directly here.
    const supabase = await getSupabaseClient();
    try {
      const { error } = await supabase.auth.signInAnonymously({
        options: { captchaToken: token },
      });
      if (error) {
        console.error("Retry anonymous auth failed:", error);
        // If it fails again, we might need to show captcha again or error out
        // For now, let the page reload or user retry by refreshing
      } else {
        // Success! The original useEffect will eventually realize there is a session?
        // No, the useEffect only runs ONCE. We need to continue initialization.
        // We can force a reload of the page to restart standard flow,
        // OR properly refactor initGame to be callable.
        // Refactoring initGame to be callable is better but tricky with useEffect closure.
        // For this hotfix, window.location.reload() is safest to ensure full clean state initialization
        // BUT that might loop if captcha keeps failing.
        // Better: Call a simplified continuation.

        // Actually, simplest is to just Reload. If session exists (verified), it will skip auth next time.
        globalThis.location.reload();
      }
    } catch (error) {
      console.error("Captcha verification error:", error);
    }
  };

  // auth listener for real-time updates (login/logout)
  const router = useRouter();
  useEffect(() => {
    // Use a ref to hold the subscription so the sync cleanup fn can unsubscribe
    // even though the import is async.
    const subscriptionReference = {
      current: null as { unsubscribe: () => void } | null,
    };
    let cancelled = false;

    void getSupabaseClient().then((supabase) => {
      if (cancelled) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        // INITIAL_SESSION fires synchronously when getSession() is first called —
        // initGame already reads it and sets user state there. Calling setUser here
        // would cause a duplicate re-render on every page load.
        if (_event === "INITIAL_SESSION") return;

        const newUser = session?.user ?? null;

        // Anonymous SIGNED_IN is handled by initGame (verifyAuthSession sets user there).
        // Calling setUser here would duplicate the re-render triggered by initGame.
        const isAnonymousSignIn =
          _event === "SIGNED_IN" && newUser?.is_anonymous === true;
        if (isAnonymousSignIn) return;

        setUser(newUser);
        // Lazy fire-and-forget: Sentry user metadata — not time-sensitive.
        // Extracted to module-level fn to avoid promise/no-nesting.
        updateSentryUser(newUser);

        if (_event === "SIGNED_IN" || _event === "SIGNED_OUT") {
          router.refresh();
        }
      });
      subscriptionReference.current = subscription;
      return null;
    });

    return () => {
      // eslint-disable-next-line fp/no-mutation -- reassigning let flag to cancel pending async import on cleanup
      cancelled = true;
      subscriptionReference.current?.unsubscribe();
    };
  }, [router]);

  // Initialize Game (with proper auth sequencing)
  // eslint-disable-next-line sonarjs/max-lines-per-function -- thin useEffect wrapper; inner initGame complexity annotated below
  useEffect(() => {
    // eslint-disable-next-line sonarjs/max-lines-per-function,sonarjs/cognitive-complexity -- initGame orchestrates sequential auth (anon sign-in, verify), challenge fetch, and game session init; steps are tightly interdependent and cannot be split without losing clarity
    const initGame = async () => {
      performance.mark("eauxle:init_start");

      const safetyTimeout = setTimeout(() => {
        console.warn("[GameProvider] initGame safety timeout reached!");
        setLoading(false);
      }, 15_000);

      try {
        // 1. Ensure Auth (Anonymous) - MUST complete before any DB operations
        // Dynamic import via getSupabaseClient(): keeps Supabase (~285KB) out of the critical render path.
        const supabase = await getSupabaseClient();
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();
        performance.mark("eauxle:session_check_end");
        performance.measure(
          "eauxle.session_check",
          "eauxle:init_start",
          "eauxle:session_check_end",
        );

        if (existingSession) {
          setUser(existingSession.user);
        }

        // Track Anonymous Session for future migration (if existing)
        if (existingSession?.user.is_anonymous) {
          localStorage.setItem(
            "eauxle_anon_player_id",
            existingSession.user.id,
          );
        }

        if (!existingSession) {
          performance.mark("eauxle:anon_auth_start");
          const { error: authError } = await supabase.auth.signInAnonymously();
          performance.mark("eauxle:anon_auth_end");
          performance.measure(
            "eauxle.anon_auth",
            "eauxle:anon_auth_start",
            "eauxle:anon_auth_end",
          );

          if (authError) {
            // Check for Captcha requirement first
            // AuthApiError extends Error — instanceof Error + message check is sufficient
            if (
              authError instanceof Error &&
              authError.message.includes("captcha")
            ) {
              console.warn(
                "[GameProvider] Captcha required for anonymous auth - triggering modal",
              );
              setIsCaptchaRequired(true);
              setLoading(false);
              clearTimeout(safetyTimeout);
              performance.mark("eauxle:init_end");
              return;
            }

            console.error("Anonymous auth failed:", authError);
            setLoading(false);
            clearTimeout(safetyTimeout);
            performance.mark("eauxle:init_end");
            return;
          }

          // Verification loop with exponential backoff: Ensure session is set in client state AND cookies
          // getSession() reads from Supabase client state populated from cookies by @supabase/ssr.
          performance.mark("eauxle:verify_start");
          const { user: verifiedUser, verified } =
            await verifyAuthSession(supabase);
          performance.mark("eauxle:verify_end");
          performance.measure(
            "eauxle.verify",
            "eauxle:verify_start",
            "eauxle:verify_end",
          );

          if (verifiedUser != null) {
            // Track Anonymous Session for future migration
            if (verifiedUser.is_anonymous) {
              localStorage.setItem("eauxle_anon_player_id", verifiedUser.id);
            }
            setUser(verifiedUser);
          }
          if (!verified) {
            console.warn(
              "[GameProvider] Auth session not verified after 3 attempts.",
            );
          }
        }

        // 2. Gate 6: If SSR challenge is present, skip startGame entirely.
        // startGame is deferred to the first user action (makeGuess/handleSkip).
        // setAuthReady(true) signals that the JWT is ready for lazy init.
        if (initialChallenge) {
          captureAnalyticsEvent("daily_challenge_viewed", {
            challenge_number: initialChallenge.id,
          });
          setAuthReady(true);
          // sessionReady already set via lazy useState when initialSession exists
          if (initialSession) setSessionReady(true);
          performance.mark("eauxle:session_ready");
          performance.mark("eauxle:init_end");
          clearTimeout(safetyTimeout);
          setLoading(false);
          return;
        }

        // No SSR challenge: old flow — read inherited count, fetch challenge + start game.
        const storedInherited = sessionStorage.getItem(
          "eauxle_declined_anon_attempts",
        );
        const parsedStored =
          storedInherited === null ? 0 : Number.parseInt(storedInherited, 10);
        const inheritedCount = Math.max(
          0,
          Math.min(5, Number.isNaN(parsedStored) ? 0 : parsedStored),
        );
        if (inheritedCount > 0) {
          sessionStorage.removeItem("eauxle_declined_anon_attempts");
        }

        // No SSR → initializeGame (2 roundtrips). Includes automatic retry on
        // challenge-without-session (timing issue with cookie propagation).
        performance.mark("eauxle:game_fetch_start");
        const { challenge, session } = await fetchChallengeAndSession(
          undefined,
          undefined,
          inheritedCount,
        );
        performance.mark("eauxle:game_fetch_end");
        performance.measure(
          "eauxle.game_fetch",
          "eauxle:game_fetch_start",
          "eauxle:game_fetch_end",
        );

        if (challenge && session) {
          captureAnalyticsEvent("daily_challenge_viewed", {
            challenge_number: challenge.id,
          });

          setDailyPerfume({
            concentration: undefined,
            id: "daily",
            imageUrl: "/placeholder.svg", // Will be overwritten by session
            name: "Mystery Perfume", // Name is secret!
            xsolve: challenge.xsolve,
          });
          setClues(session.revealed);

          setSessionId(session.sessionId);
          setNonce(session.nonce);
          if (session.imageUrl) setImageUrl(session.imageUrl);

          // Restore baseAttemptCount for new sessions with no guess history
          if (inheritedCount > 0 && session.guesses.length === 0) {
            setBaseAttemptCount(inheritedCount);
          }

          // If session returned answer (game over), update dailyPerfume
          if (session.answerName) {
            setDailyPerfume((previous) => ({
              ...previous,
              concentration: session.answerConcentration,
              name: session.answerName ?? "",
            }));
          }

          if (session.guesses.length > 0) {
            setAttempts(hydrateAttempts(session.guesses));

            const lastGuess = session.guesses.at(-1);
            if (lastGuess?.isCorrect) setGameState("won");
            else if (session.guesses.length >= maxAttempts)
              setGameState("lost");
          }
        }
        setAuthReady(true);
        setSessionReady(true);
        performance.mark("eauxle:session_ready");
        performance.mark("eauxle:init_end");
        clearTimeout(safetyTimeout);
        setLoading(false);
      } catch (error) {
        console.error("Failed to init game", error);
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };
    void initGame();
    // initGame is defined inside this effect and only needs to run once on mount
  }, [initialChallenge, initialSession, maxAttempts]);

  // Merge dynamic image into the daily perfume object.
  // useMemo keeps the reference stable so GameStateProvider and GameActionsProvider
  // do not see a "changed" dailyPerfume prop on every GameProvider re-render.
  const activePerfume = useMemo(
    () => ({ ...dailyPerfume, imageUrl }),
    [dailyPerfume, imageUrl],
  );

  return (
    <GameStateProvider
      attempts={attempts}
      authReady={authReady}
      baseAttemptCount={baseAttemptCount}
      clues={clues}
      dailyPerfume={activePerfume}
      gameState={gameState}
      loading={loading}
      maxAttempts={maxAttempts}
      sessionId={sessionId}
      sessionReady={sessionReady}
      user={user}
    >
      <GameActionsProvider
        attempts={attempts}
        authReady={authReady}
        baseAttemptCount={baseAttemptCount}
        challengeId={initialChallenge?.id ?? null}
        gameState={gameState}
        maxAttempts={maxAttempts}
        nonce={nonce}
        sessionId={sessionId}
        setAttempts={setAttempts}
        setBaseAttemptCount={setBaseAttemptCount}
        setClues={setClues}
        setDailyPerfume={setDailyPerfume}
        setGameState={setGameState}
        setImageUrl={setImageUrl}
        setLoading={setLoading}
        setNonce={setNonce}
        setSessionId={setSessionId}
        setSessionReady={setSessionReady}
      >
        {children}
        <AuthCaptchaModal
          isOpen={isCaptchaRequired}
          onVerify={handleCaptchaVerify}
        />
        <MigrationModal />
      </GameActionsProvider>
    </GameStateProvider>
  );
}
