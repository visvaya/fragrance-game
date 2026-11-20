"use client";

import {
  useState,
  // eslint-disable-next-line no-restricted-imports -- subscription: onAuthStateChange listener; orchestration: async auth+challenge+session init
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import dynamic from "next/dynamic";

import {
  initializeGame,
  startGame,
  type DailyChallenge,
  type StartGameResponse,
} from "@/app/actions/game-actions";
import { captureAnalyticsEvent } from "@/components/providers/posthog-provider";
import { useRouter } from "@/i18n/routing";
import { shouldReloadOnAuthChange } from "@/lib/auth/auth-change-reload";
import { MAX_GUESSES } from "@/lib/constants";
import {
  gameSessionReducer,
  initialGameSessionState,
  type GameSessionAction,
} from "@/lib/game/game-session-state";
import { env } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase/get-client";

import { signInAnonymousPlayer } from "./anonymous-auth";
import { whenIdle } from "./when-idle";

import {
  GameStateProvider,
  useGameState,
  GameActionsProvider,
  useGameActions,
  useUIPreferences,
} from "./contexts";

import type { User } from "@supabase/supabase-js";

// Lazy-loaded modals – not needed for first render, keep them out of critical path
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

/** Longest wait for an idle moment before the anonymous sign-in starts anyway. */
const AUTH_IDLE_TIMEOUT_MS = 2000;

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
    getRevealedPerfumer: () => state.revealedPerfumer,
    getRevealedYear: () => state.revealedYear,
  };
}

/**
 * Fetches the daily challenge + game session using the most efficient path:
 * - SSR-provided data used directly if available (0 roundtrips)
 * - Otherwise calls initializeGame (2 roundtrips) or startGame (1 roundtrip)
 * Includes one automatic retry when challenge arrives but session fails.
 */
async function fetchChallengeAndSession(
  initialChallenge?: DailyChallenge,
  initialSession?: StartGameResponse | null,
): Promise<{
  challenge: DailyChallenge | null;
  session: StartGameResponse | null;
}> {
  if (initialChallenge) {
    if (initialSession)
      return { challenge: initialChallenge, session: initialSession };
    const session = await startGame(initialChallenge.id).catch(
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

  const { challenge, session } = await initializeGame();

  // Retry if challenge arrived but session failed (cookies not yet processed)
  if (challenge && session == null) {
    console.warn(
      "[GameProvider] Got challenge but no session. Retrying session creation...",
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const retrySession = await startGame(challenge.id).catch(
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
 * Finishes start-up once the player is signed in. With an SSR challenge the game session
 * starts lazily on the first move; without one, the challenge and session are fetched now.
 * @param initialChallenge - Challenge rendered on the server, if any.
 * @param dispatch - Game session reducer dispatch.
 * @param setAuthReady - Marks the sign-in as done for the lazy session start.
 */
async function finishInit(
  initialChallenge: DailyChallenge | null | undefined,
  dispatch: Dispatch<GameSessionAction>,
  setAuthReady: (ready: boolean) => void,
): Promise<void> {
  if (initialChallenge) {
    captureAnalyticsEvent("daily_challenge_viewed", {
      challenge_number: initialChallenge.id,
    });
    setAuthReady(true);
    performance.mark("eauxle:session_ready");
    return;
  }

  performance.mark("eauxle:game_fetch_start");
  const { challenge, session } = await fetchChallengeAndSession();
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
    dispatch({ challenge, session, type: "sessionHydrated" });
  }
  setAuthReady(true);
  dispatch({ type: "sessionReady" });
  performance.mark("eauxle:session_ready");
}

/**
 * GameProvider - Main orchestrator that manages state and coordinates contexts
 * All state lives here as single source of truth
 * Contexts receive state and the dispatch function as props
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
  // The lazy initializer populates the state synchronously from initialSession on the very
  // first render: no empty-state flash, no extra useEffect re-render cycle.
  const [game, dispatch] = useReducer(
    gameSessionReducer,
    {
      initialChallenge,
      initialImageUrl,
      initialSession,
    },
    initialGameSessionState,
  );
  const [loading, setLoading] = useState(!initialChallenge);
  /** True once anonymous auth JWT is confirmed – gates lazy startGame in game-actions-context */
  const [authReady, setAuthReady] = useState(
    initialSession !== null && initialSession !== undefined,
  );
  const [user, setUser] = useState<User | null>(null);
  /** "pending": Turnstile runs invisibly; "interactive": Cloudflare asked for a click. */
  const [captchaStage, setCaptchaStage] = useState<
    "none" | "pending" | "interactive"
  >("none");
  // A new key remounts the widget for a fresh token after a failed sign-in.
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  const handleCaptchaVerify = async (token: string) => {
    try {
      const supabase = await getSupabaseClient();
      const result = await signInAnonymousPlayer(supabase, token);
      if (!result.ok) {
        console.error("Anonymous sign-in with captcha failed:", result.message);
        setCaptchaStage("interactive");
        setCaptchaAttempt((attempt) => attempt + 1);
        return;
      }
      setCaptchaStage("none");
      if (result.user) setUser(result.user);
      // Without an SSR challenge the board waits for the fetch; with one it stays usable.
      if (!initialChallenge) setLoading(true);
      await finishInit(initialChallenge, dispatch, setAuthReady);
    } catch (error) {
      console.error("Captcha verification error:", error);
    } finally {
      setLoading(false);
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
    // Id of the user the client currently plays as; a sign-in as someone else needs a reload.
    let knownUserId: string | null = null;

    void getSupabaseClient().then((supabase) => {
      if (cancelled) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        // INITIAL_SESSION fires synchronously when getSession() is first called –
        // initGame already reads it and sets user state there. Calling setUser here
        // would cause a duplicate re-render on every page load.
        const newUser = session?.user ?? null;
        const previousUserId = knownUserId;
        // eslint-disable-next-line fp/no-mutation -- reassigning let tracker to remember the current user across auth events
        knownUserId = newUser?.id ?? null;

        if (_event === "INITIAL_SESSION") return;

        // Anonymous SIGNED_IN is handled by initGame (verifyAuthSession sets user there).
        // Calling setUser here would duplicate the re-render triggered by initGame.
        const isAnonymousSignIn =
          _event === "SIGNED_IN" && newUser?.is_anonymous === true;
        if (isAnonymousSignIn) return;

        // Signing in as a different user (typically from a guest session): a soft
        // refresh would keep the previous user's game state, so reload the page.
        if (shouldReloadOnAuthChange(previousUserId, _event, newUser)) {
          globalThis.location.reload();
          return;
        }

        setUser(newUser);
        // Lazy fire-and-forget: Sentry user metadata – not time-sensitive.
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

  // Initialize Game (with proper auth sequencing). Runs when the browser is idle after
  // start-up, so the sign-in does not compete with hydration; a guess picked earlier waits
  // for authReady (pendingGuess in game-actions-context).
  useEffect(() => {
    const initGame = async () => {
      performance.mark("eauxle:init_start");

      const safetyTimeout = setTimeout(() => {
        console.warn("[GameProvider] initGame safety timeout reached!");
        setLoading(false);
      }, 15_000);

      try {
        // Dynamic import via getSupabaseClient(): keeps Supabase out of the critical render path.
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

        // One-time cleanup of keys from the former client-side guest tracking.
        try {
          localStorage.removeItem("eauxle_anon_player_id");
          sessionStorage.removeItem("eauxle_declined_anon_attempts");
        } catch {
          // Storage can be unavailable (private mode); nothing to clean then.
        }

        if (existingSession) {
          setUser(existingSession.user);
        } else if (env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
          // Supabase requires a captcha token for anonymous sign-in: the invisible widget
          // gets one and handleCaptchaVerify signs in and finishes the initialization.
          setCaptchaStage("pending");
          return;
        } else {
          const result = await signInAnonymousPlayer(supabase, null);
          if (!result.ok) {
            console.error("Anonymous auth failed:", result.message);
            return;
          }
          if (result.user) setUser(result.user);
        }

        await finishInit(initialChallenge, dispatch, setAuthReady);
      } catch (error) {
        console.error("Failed to init game", error);
      } finally {
        performance.mark("eauxle:init_end");
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };
    return whenIdle(() => void initGame(), AUTH_IDLE_TIMEOUT_MS);
    // initGame is defined inside this effect and only needs to run once on mount
  }, [initialChallenge]);

  // Merge dynamic image into the daily perfume object.
  // useMemo keeps the reference stable so GameStateProvider and GameActionsProvider
  // do not see a "changed" dailyPerfume prop on every GameProvider re-render.
  const activePerfume = useMemo(
    () => ({ ...game.dailyPerfume, imageUrl: game.imageUrl }),
    [game.dailyPerfume, game.imageUrl],
  );

  return (
    <GameStateProvider
      attempts={game.attempts}
      authReady={authReady}
      clues={game.clues}
      dailyPerfume={activePerfume}
      gameState={game.gameState}
      loading={loading}
      maxAttempts={MAX_GUESSES}
      sessionId={game.sessionId}
      sessionReady={game.sessionReady}
      user={user}
    >
      <GameActionsProvider
        attempts={game.attempts}
        authReady={authReady}
        challengeId={initialChallenge?.id ?? null}
        dispatch={dispatch}
        gameState={game.gameState}
        maxAttempts={MAX_GUESSES}
        nonce={game.nonce}
        sessionId={game.sessionId}
        setLoading={setLoading}
      >
        {children}
        {captchaStage === "none" ? null : (
          <AuthCaptchaModal
            isInteractive={captchaStage === "interactive"}
            key={captchaAttempt}
            onBeforeInteractive={() => setCaptchaStage("interactive")}
            onError={() => setCaptchaStage("interactive")}
            onVerify={(token) => void handleCaptchaVerify(token)}
          />
        )}
        <MigrationModal />
      </GameActionsProvider>
    </GameStateProvider>
  );
}
