"use client";

import { useState, useEffect, type ReactNode } from "react";

import { AuthApiError, type User } from "@supabase/supabase-js";

import {
  initializeGame,
  startGame,
  type DailyChallenge,
  type StartGameResponse,
} from "@/app/actions/game-actions";
import { AuthCaptchaModal } from "@/components/auth/auth-captcha-modal";
import { MigrationModal } from "@/components/auth/migration-modal";
import { captureAnalyticsEvent } from "@/components/providers/posthog-provider";
import { useRouter } from "@/i18n/routing";
import { MASK_CHAR, MAX_GUESSES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

import {
  GameStateProvider,
  useGameState,
  GameActionsProvider,
  useGameActions,
  useUIPreferences,
  type Attempt,
} from "./contexts";

// Skeleton / Default for initialization (prevents null checks everywhere)
const SKELETON_PERFUME = {
  brand: "?????" as string,
  concentration: undefined as string | undefined,
  gender: "?????",
  id: "skeleton",
  imageUrl: "/placeholder.svg?height=400&width=400",
  isLinear: false as boolean,
  name: "?????" as string,
  notes: {
    // Realistic note counts to avoid layout shift when real data loads
    top: ["?????", "?????", "?????"],
    heart: ["?????", "?????", "?????"],
    base: ["?????", "?????", "?????"],
  },
  perfumer: "?????" as string,
  xsolve: 0 as number,
  year: MASK_CHAR.repeat(4) as string | number,
};

type GameState = "playing" | "won" | "lost";

/**
 * Helper function to calculate masked values for snapshots (used during hydration)
 */
function calculateMaskedValues(
  level: number,
  targetBrand: string,
  targetYear: number | string,
) {
  // Simplified reveal for hydration - actual logic in contexts/game-state-context.tsx
  const guessMaskedBrand = level === 1 ? "?????" : targetBrand;

  // Year
  let guessMaskedYear = MASK_CHAR.repeat(4);
  if (targetYear) {
    const yearString = targetYear.toString();
    if (level >= 5) guessMaskedYear = yearString;
    else
      switch (level) {
        case 4: {
          guessMaskedYear = yearString.slice(0, 3) + MASK_CHAR;
          break;
        }
        case 3: {
          guessMaskedYear = yearString.slice(0, 2) + MASK_CHAR.repeat(2);
          break;
        }
        case 2: {
          {
            guessMaskedYear = yearString.slice(0, 1) + MASK_CHAR.repeat(3);
            // No default
          }
          break;
        }
      }
  }

  return { guessMaskedBrand, guessMaskedYear };
}

/**
 * Pure function: reconstructs Attempt[] from raw server guesses + challenge data.
 * Called synchronously in useState lazy initializer so attempts are ready on first render.
 * Also reused in initGame to avoid code duplication.
 */
function hydrateAttempts(
  guesses: StartGameResponse["guesses"] | undefined,
  challenge: DailyChallenge | null | undefined,
): Attempt[] {
  if (!guesses || guesses.length === 0 || !challenge) return [];

  const enrichedAttempts: Attempt[] = [];

  for (const [index, g] of guesses.entries()) {
    if ((g as { isSkip?: boolean }).isSkip) {
      enrichedAttempts.push({
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
      });
      continue;
    }

    const currentLevel = index + 1;
    const isCorrect = g.isCorrect;
    const brandMatch =
      g.brandName.toLowerCase() === challenge.clues.brand.toLowerCase();
    const yearMatchDiff = (g.year ?? 0) - challenge.clues.year;
    let yearMatch: "correct" | "close" | "wrong" = "wrong";
    if (isCorrect || yearMatchDiff === 0) yearMatch = "correct";
    else if (Math.abs(yearMatchDiff) <= 3) yearMatch = "close";

    const anyBrandMatch =
      enrichedAttempts.some((a) => a.feedback.brandMatch) || brandMatch;
    const anyYearMatch =
      enrichedAttempts.some((a) => a.feedback.yearMatch === "correct") ||
      yearMatch === "correct";

    const { guessMaskedBrand, guessMaskedYear } = calculateMaskedValues(
      currentLevel,
      g.brandName,
      g.year ?? 0,
    );
    const { guessMaskedBrand: answerClueBrand, guessMaskedYear: answerClueYear } =
      calculateMaskedValues(currentLevel, challenge.clues.brand, challenge.clues.year);

    const brandRevealedByLevel = answerClueBrand === challenge.clues.brand;
    const yearRevealedByLevel = answerClueYear === challenge.clues.year.toString();
    const genderMatch =
      g.gender?.toLowerCase() === challenge.clues.gender.toLowerCase();
    const anyGenderMatch =
      enrichedAttempts.some((a) => a.snapshot?.genderRevealed) || genderMatch;

    let yearDirection: "lower" | "higher" | "equal" = "equal";
    if (yearMatchDiff > 0) yearDirection = "lower";
    else if (yearMatchDiff < 0) yearDirection = "higher";

    enrichedAttempts.push({
      brand: g.brandName,
      concentration: g.concentration,
      feedback: g.feedback ?? {
        brandMatch,
        notesMatch: isCorrect ? 1 : 0,
        perfumerMatch: isCorrect ? "full" : "none",
        yearDirection,
        yearMatch,
      },
      gender: g.gender,
      guess: g.perfumeName,
      isCorrect: g.isCorrect,
      perfumeId: g.perfumeId,
      perfumers: g.perfumers,
      snapshot: {
        brandRevealed: anyBrandMatch || brandRevealedByLevel,
        genderRevealed: anyGenderMatch,
        guessMaskedBrand,
        guessMaskedYear,
        yearRevealed: anyYearMatch || yearRevealedByLevel,
      },
      year: g.year,
    });
  }

  return enrichedAttempts;
}

/**
 * Backward-compatible unified hook
 * Combines all three contexts for components not yet migrated
 */
// eslint-disable-next-line react-refresh/only-export-components
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

// Export Attempt type for backward compatibility

// Helper to calculate revealed brand (needed for actions context)
function getRevealedBrandHelper(brand: string, level: number) {
  if (level === 1) return "?????";
  // Simplified - full logic in GameStateContext
  return brand; // Placeholder
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
    hydrateAttempts(initialSession?.guesses, initialChallenge),
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
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    initialSession?.sessionId ?? null,
  );
  const [dailyPerfume, setDailyPerfume] = useState<typeof SKELETON_PERFUME>(
    initialChallenge?.clues
      ? {
        brand: initialChallenge.clues.brand,
        concentration: initialChallenge.clues.concentration,
        gender: initialChallenge.clues.gender,
        id: "daily",
        imageUrl: initialImageUrl ?? "/placeholder.svg?height=400&width=400",
        isLinear: initialChallenge.clues.isLinear,
        name: "Mystery Perfume",
        notes: initialChallenge.clues.notes,
        perfumer: initialChallenge.clues.perfumer,
        xsolve: initialChallenge.clues.xsolve,
        year: initialChallenge.clues.year,
      }
      : SKELETON_PERFUME,
  );
  const [discoveredPerfumers, setDiscoveredPerfumers] = useState<Set<string>>(
    new Set(),
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
    const supabase = createClient();
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
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);

      // Skip refresh for anonymous sign-in: anonymous sessions are created
      // automatically on every page load, and router.refresh() would remount
      // client components, resetting transient UI state (e.g. open modals).
      const isAnonymousSignIn =
        _event === "SIGNED_IN" && newUser?.is_anonymous === true;

      // Also skip if it's just the initial session event which happens on every load
      if (_event === "INITIAL_SESSION") return;

      if (
        (_event === "SIGNED_IN" || _event === "SIGNED_OUT") &&
        !isAnonymousSignIn
      ) {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Initialize Game (with proper auth sequencing)
  useEffect(() => {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    const initGame = async () => {
      const safetyTimeout = setTimeout(() => {
        console.warn("[GameProvider] initGame safety timeout reached!");
        setLoading(false);
      }, 15_000);

      try {
        // 1. Ensure Auth (Anonymous) - MUST complete before any DB operations
        const supabase = createClient();
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();

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
          const { error: authError } = await supabase.auth.signInAnonymously();
          if (authError) {
            // Check for Captcha requirement first
            if (
              authError instanceof AuthApiError &&
              authError.message.includes("captcha")
            ) {
              console.warn(
                "[GameProvider] Captcha required for anonymous auth - triggering modal",
              );
              setIsCaptchaRequired(true);
              setLoading(false);
              clearTimeout(safetyTimeout);
              return;
            }

            console.error("Anonymous auth failed:", authError);
            setLoading(false);
            clearTimeout(safetyTimeout);
            return;
          }

          // Verification loop with exponential backoff: Ensure session is set in client state AND cookies
          let verified = false;
          const maxAttempts = 3;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const {
              data: { session: s },
            } = await supabase.auth.getSession();

            // getSession() reads from Supabase client state which is populated from
            // cookies by @supabase/ssr — if session exists, the cookie is already set.
            if (s) {
              verified = true;

              // Track Anonymous Session for future migration
              if (s.user.is_anonymous) {
                localStorage.setItem("eauxle_anon_player_id", s.user.id);
              }
              setUser(s.user);
              break;
            }

            // Exponential backoff: 50ms, 100ms, 200ms
            await new Promise((resolve) =>
              setTimeout(resolve, 50 * Math.pow(2, attempt)),
            );
          }
          if (!verified) {
            console.warn(
              "[GameProvider] Auth session not verified after",
              maxAttempts,
              "attempts.",
            );
          }
        }

        // 2. Fetch challenge and start game
        // Read inherited attempt count stored by MigrationModal.handleCancel
        const storedInherited = sessionStorage.getItem(
          "eauxle_declined_anon_attempts",
        );
        const inheritedCount = storedInherited
          ? Math.max(0, Math.min(5, Number.parseInt(storedInherited, 10) || 0))
          : 0;
        if (inheritedCount > 0) {
          sessionStorage.removeItem("eauxle_declined_anon_attempts");
        }

        let challenge: DailyChallenge | null;
        let session: Awaited<ReturnType<typeof startGame>> | null;

        if (initialChallenge) {
          // Challenge known from SSR — use pre-fetched session if available (0 roundtrips),
          // or call startGame as fallback (1 roundtrip instead of 2).
          challenge = initialChallenge;
          if (initialSession) {
            // Session already fetched server-side — no network call needed
            session = initialSession;
          } else {
            session = null;
            try {
              session = await startGame(initialChallenge.id, inheritedCount);
            } catch (error) {
              console.error(
                "[GameProvider] startGame with SSR challenge failed:",
                error,
              );
              // session remains null — retry logic below (challenge && !session) will handle it
            }
          }
        } else {
          // Fallback: SSR didn't provide challenge (no daily challenge, DB error)
          ({ challenge, session } = await initializeGame(inheritedCount));
        }

        // 2b. If we got challenge but NO session (Unauthorized retry)
        // This happens if the server action is called slightly before cookies are processed
        if (challenge && !session) {
          console.warn(
            "[GameProvider] Got challenge but no session. Retrying session creation...",
          );
          await new Promise((resolve) => setTimeout(resolve, 200)); // Tiny beat
          try {
            session = await startGame(challenge.id, inheritedCount);
          } catch (error) {
            console.error("[GameProvider] Retry startGame failed:", error);
          }
        }

        if (challenge && session) {
          captureAnalyticsEvent("daily_challenge_viewed", {
            challenge_number: challenge.id,
          });

          // Setup Daily Perfume Clues — skip when already initialized from SSR prop
          if (!initialChallenge) {
            setDailyPerfume({
              brand: challenge.clues.brand,
              concentration: challenge.clues.concentration,
              gender: challenge.clues.gender,
              id: "daily",
              imageUrl: "/placeholder.svg", // Will be overwritten by session
              isLinear: challenge.clues.isLinear,
              name: "Mystery Perfume", // Name is secret!
              notes: challenge.clues.notes,
              perfumer: challenge.clues.perfumer,
              xsolve: challenge.clues.xsolve,
              year: challenge.clues.year,
            });
          }

          // Skip redundant setState calls when state was already seeded from initialSession via
          // lazy useState initializers — avoids an unnecessary re-render cycle.
          const alreadyHydrated = initialSession !== null && initialSession !== undefined;

          if (!alreadyHydrated) {
            setSessionId(session.sessionId);
            setNonce(session.nonce);
            if (session.imageUrl) setImageUrl(session.imageUrl);
          }

          // Restore baseAttemptCount for new sessions with no guess history
          // (happens when player declined anonymous migration and inherited attempts)
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

          // Hydrate attempts — use the shared helper to reconstruct Attempt[] from raw guesses.
          // If initialSession was already used in lazy useState, attempts are pre-populated
          // and we only call setAttempts when coming from the fallback path (no initialSession).
          if (!alreadyHydrated && session.guesses.length > 0) {
            const enrichedAttempts = hydrateAttempts(session.guesses, challenge);
            setAttempts(enrichedAttempts);

            const lastGuess = session.guesses.at(-1);
            if (lastGuess?.isCorrect) setGameState("won");
            else if (session.guesses.length >= maxAttempts) setGameState("lost");
          }
        }
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

  // Track discovered perfumers
  // eslint-disable-next-line sonarjs/cognitive-complexity
  useEffect(() => {
    const newDiscovered = new Set<string>();
    for (const attempt of attempts) {
      if (
        attempt.feedback.perfumerMatch === "full" ||
        attempt.feedback.perfumerMatch === "partial"
      ) {
        const guessPerfumers = attempt.perfumers ?? [];
        const answerPerfumers = new Set(
          dailyPerfume.perfumer.split(",").map((p) => p.trim().toLowerCase()),
        );

        for (const p of guessPerfumers) {
          if (answerPerfumers.has(p.trim().toLowerCase())) {
            const originalName = dailyPerfume.perfumer
              .split(",")
              .find((n) => n.trim().toLowerCase() === p.trim().toLowerCase());
            if (originalName) newDiscovered.add(originalName.trim());
          }
        }

        if (attempt.feedback.perfumerMatch === "full") {
          for (const p of dailyPerfume.perfumer.split(","))
            newDiscovered.add(p.trim());
        }
      }
    }
    setDiscoveredPerfumers(newDiscovered);
  }, [attempts, dailyPerfume.perfumer]);

  // Merge dynamic image into the daily perfume object
  const activePerfume = { ...dailyPerfume, imageUrl };

  // Calculate helper flags needed by GameActionsProvider
  const currentAttempt = attempts.length + 1 + baseAttemptCount;
  const revealLevel = Math.min(currentAttempt, maxAttempts);

  const isBrandRevealed =
    attempts.some((a) => a.feedback.brandMatch) ||
    getRevealedBrandHelper(dailyPerfume.brand, revealLevel) ===
    dailyPerfume.brand;

  const isYearRevealed = attempts.some(
    (a) => a.feedback.yearMatch === "correct",
  );

  return (
    <GameStateProvider
      attempts={attempts}
      baseAttemptCount={baseAttemptCount}
      dailyPerfume={activePerfume}
      discoveredPerfumers={discoveredPerfumers}
      gameState={gameState}
      loading={loading}
      maxAttempts={maxAttempts}
      sessionId={sessionId}
      user={user}
    >
      <GameActionsProvider
        attempts={attempts}
        baseAttemptCount={baseAttemptCount}
        dailyPerfume={activePerfume}
        gameState={gameState}
        isBrandRevealed={isBrandRevealed}
        isYearRevealed={isYearRevealed}
        maxAttempts={maxAttempts}
        nonce={nonce}
        sessionId={sessionId}
        setAttempts={setAttempts}
        setBaseAttemptCount={setBaseAttemptCount}
        setDailyPerfume={setDailyPerfume}
        setDiscoveredPerfumers={setDiscoveredPerfumers}
        setGameState={setGameState}
        setImageUrl={setImageUrl}
        setLoading={setLoading}
        setNonce={setNonce}
        setSessionId={setSessionId}
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
