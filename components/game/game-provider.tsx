"use client";

import { useState, useEffect, type ReactNode } from "react";

import { AuthApiError } from "@supabase/supabase-js";
import { usePostHog } from "posthog-js/react";

import { initializeGame, startGame } from "@/app/actions/game-actions";
import { AuthCaptchaModal } from "@/components/auth/auth-captcha-modal";
import { MigrationModal } from "@/components/auth/migration-modal";
import { MAX_GUESSES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

import {
  GameStateProvider,
  useGameState,
  GameActionsProvider,
  useGameActions,
  UIPreferencesProvider,
  useUIPreferences,
  type Attempt,
} from "./contexts";

// Skeleton / Default for initialization (prevents null checks everywhere)

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
    base: ["?????", "?????", "?????"],
    heart: ["?????", "?????", "?????"],
    top: ["?????", "?????", "?????"],
  },
  perfumer: "?????" as string,
  xsolve: 0 as number,
  year: "____" as string | number,
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
  // Brand
  const brandPercentages = [0, 0, 0.15, 0.4, 0.7, 1];
  // Simplified reveal for hydration - actual logic in contexts/game-state-context.tsx
  const guessMaskedBrand = level === 1 ? "?????" : targetBrand;

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

// Export Attempt type for backward compatibility

/**
 * GameProvider - Main orchestrator that manages state and coordinates contexts
 * All state lives here as single source of truth
 * Contexts receive state and setters as props
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog();

  // === Core Game State (Single Source of Truth) ===
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState<GameState>("playing");
  const [imageUrl, setImageUrl] = useState<string>(
    "/placeholder.svg?height=400&width=400",
  );
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dailyPerfume, setDailyPerfume] =
    useState<typeof SKELETON_PERFUME>(SKELETON_PERFUME);
  const [discoveredPerfumers, setDiscoveredPerfumers] = useState<Set<string>>(
    new Set(),
  );
  const [nonce, setNonce] = useState<string>("");
  const [isCaptchaRequired, setIsCaptchaRequired] = useState(false);
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

  // Initialize Game (with proper auth sequencing)
  useEffect(() => {
    const initGame = async () => {
      console.log("[GameProvider] initGame started");
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

        // Track Anonymous Session for future migration (if existing)
        if (existingSession?.user.is_anonymous) {
          localStorage.setItem(
            "eauxle_anon_player_id",
            existingSession.user.id,
          );
        }

        if (!existingSession) {
          console.log("[GameProvider] No session, signing in anonymously...");
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
          const maxAttempts = 5; // Reduced from 10
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const {
              data: { session: s },
            } = await supabase.auth.getSession();

            // Check if cookie is present (Server Actions rely on this!)
            const hasCookie =
              document.cookie.includes("sb-") &&
              document.cookie.includes("-auth-token");

            if (s && hasCookie) {
              // console.log("[GameProvider] Auth session & cookie verified");
              verified = true;

              // Track Anonymous Session for future migration
              if (s.user.is_anonymous) {
                localStorage.setItem("eauxle_anon_player_id", s.user.id);
              }
              break;
            }

            // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
            await new Promise((resolve) =>
              setTimeout(resolve, 100 * Math.pow(2, attempt)),
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

        // 2. Fetch challenge and start game in ONE server call (reduces round-trips)
        let { challenge, session } = await initializeGame();
        console.log("[GameProvider] initializeGame returned:", {
          challengeId: challenge?.id,
          hasChallenge: !!challenge,
          hasSession: !!session,
          sessionId: session?.sessionId,
        });

        // 2b. If we got challenge but NO session (Unauthorized retry)
        // This happens if the server action is called slightly before cookies are processed
        if (challenge && !session) {
          console.warn(
            "[GameProvider] Got challenge but no session. Retrying session creation...",
          );
          await new Promise((resolve) => setTimeout(resolve, 200)); // Tiny beat
          try {
            session = await startGame(challenge.id);
          } catch (error) {
            console.error("[GameProvider] Retry startGame failed:", error);
          }
        }

        if (challenge && session) {
          posthog.capture("daily_challenge_viewed", {
            challenge_number: challenge.id,
          });

          // Setup Daily Perfume Clues
          if (challenge.clues) {
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

          setSessionId(session.sessionId);
          setNonce(session.nonce); // Store nonce
          if (session.imageUrl) {
            setImageUrl(session.imageUrl);
          }

          // If session returned answer (game over), update dailyPerfume
          if (session.answerName) {
            setDailyPerfume((previous) => ({
              ...previous,
              concentration: session.answerConcentration,
              name: session.answerName!,
            }));
          }

          // Hydrate Attempts
          if (session.guesses && session.guesses.length > 0) {
            // Reconstruct history with correct progressive disclosure snapshots
            const enrichedAttempts: Attempt[] = [];
            // Track running state for hydration replay
            // We need to simulate the "game state" at each step to determine what was revealed
            const percentages = [0, 0, 0.15, 0.4, 0.7, 1]; // Same as getRevealedBrandHelper

            for (const [index, g] of session.guesses.entries()) {
              const currentLevel = index + 1;
              const isCorrect = g.isCorrect;

              // 1. Did this specific guess match?
              const brandMatch =
                g.brandName.toLowerCase() ===
                challenge.clues.brand.toLowerCase();
              const yearMatchDiff = (g.year || 0) - challenge.clues.year;
              const yearMatch = isCorrect
                ? "correct"
                : Math.abs(yearMatchDiff) <= 3 && yearMatchDiff !== 0
                  ? "close"
                  : yearMatchDiff === 0
                    ? "correct"
                    : "wrong";

              // 2. Was it revealed by PREVIOUS attempts (or this one)?
              // Running check: Is it revealed by ANY guess up to now?
              // Optimization: We can check just the enrichedAttempts so far.
              const anyBrandMatch =
                enrichedAttempts.some((a) => a.feedback.brandMatch) ||
                brandMatch;
              const anyYearMatch =
                enrichedAttempts.some(
                  (a) => a.feedback.yearMatch === "correct",
                ) || yearMatch === "correct";

              // 3. Was it revealed by LEVEL logic?
              // Calculate Clues for Snapshot (Use GUESS values)
              const { guessMaskedBrand, guessMaskedYear } =
                calculateMaskedValues(currentLevel, g.brandName, g.year || 0);

              // Check Reveal Status for Global State (Use ANSWER values) - needed for boolean flags
              // Note: game logic says "isBrandRevealed" if dailyPerfume.brand is revealed.
              // But here we are setting flags on the attempt snapshot for HISTORICAL rendering?
              // Attempt-log uses (feedback.brandMatch || snapshot.brandRevealed).
              // "brandRevealed" means "Is the ANSWER brand revealed at this step?".

              const {
                guessMaskedBrand: answerClueBrand,
                guessMaskedYear: answerClueYear,
              } = calculateMaskedValues(
                currentLevel,
                challenge.clues.brand,
                challenge.clues.year,
              );
              const brandRevealedByLevel =
                answerClueBrand === challenge.clues.brand;
              const yearRevealedByLevel =
                answerClueYear === challenge.clues.year.toString();

              // 4. Gender logic (simplified)
              const genderMatch =
                g.gender?.toLowerCase() ===
                challenge.clues.gender.toLowerCase();
              const anyGenderMatch =
                enrichedAttempts.some((a) => a.snapshot?.genderRevealed) ||
                genderMatch;

              const snapshot = {
                brandRevealed: anyBrandMatch || brandRevealedByLevel,
                genderRevealed: anyGenderMatch,
                guessMaskedBrand,
                guessMaskedYear,
                yearRevealed: anyYearMatch || yearRevealedByLevel,
              };

              enrichedAttempts.push({
                brand: g.brandName,
                concentration: g.concentration,
                feedback: g.feedback || {
                  brandMatch,
                  notesMatch: isCorrect ? 1 : 0, // approximated fallback
                  perfumerMatch: isCorrect ? "full" : "none", // approximated fallback
                  yearDirection:
                    yearMatchDiff > 0
                      ? "lower"
                      : yearMatchDiff < 0
                        ? "higher"
                        : "equal",
                  yearMatch: yearMatch,
                },
                gender: g.gender,
                guess: g.perfumeName,
                isCorrect: g.isCorrect,
                perfumeId: g.perfumeId,
                perfumers: g.perfumers,
                snapshot,
                year: g.year,
              });
            }
            setAttempts(enrichedAttempts);

            const lastGuess = session.guesses.at(-1);
            if (lastGuess?.isCorrect) setGameState("won");
            else if (session.guesses.length >= maxAttempts)
              setGameState("lost");
          }
        }
        clearTimeout(safetyTimeout);
        console.log("[GameProvider] initGame finished");
        setLoading(false);
      } catch (error) {
        console.error("Failed to init game", error);
        clearTimeout(safetyTimeout);
        console.log("[GameProvider] initGame finished");
        setLoading(false);
      }
    };
    void initGame();
    // initGame is defined inside this effect and only needs to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only initialization
  }, []);

  // Track discovered perfumers
  useEffect(() => {
    const newDiscovered = new Set<string>();
    for (const attempt of attempts) {
      if (
        attempt.feedback.perfumerMatch === "full" ||
        attempt.feedback.perfumerMatch === "partial"
      ) {
        const guessPerfumers = attempt.perfumers || [];
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
  const currentAttempt = attempts.length + 1;
  const revealLevel = Math.min(currentAttempt, maxAttempts);

  // Helper to calculate revealed brand (needed for actions context)
  const getRevealedBrandHelper = (brand: string, level: number) => {
    if (level === 1) return "?????";
    const percentages = [0, 0, 0.15, 0.4, 0.7, 1];
    // Simplified - full logic in GameStateContext
    return brand; // Placeholder
  };

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
      dailyPerfume={activePerfume}
      discoveredPerfumers={discoveredPerfumers}
      gameState={gameState}
      loading={loading}
      maxAttempts={maxAttempts}
      sessionId={sessionId}
    >
      <GameActionsProvider
        attempts={attempts}
        dailyPerfume={activePerfume}
        gameState={gameState}
        isBrandRevealed={isBrandRevealed}
        isYearRevealed={isYearRevealed}
        maxAttempts={maxAttempts}
        nonce={nonce}
        posthog={posthog}
        sessionId={sessionId}
        setAttempts={setAttempts}
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
