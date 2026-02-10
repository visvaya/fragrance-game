"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

import { usePostHog } from "posthog-js/react";

import {
  initializeGame,
  startGame,
  submitGuess,
  resetGame,
  type DailyChallenge,
} from "@/app/actions/game-actions";
import { MAX_GUESSES } from "@/lib/constants";
import { revealLetters } from "@/lib/game/scoring";
import { createClient } from "@/lib/supabase/client";

// Skeleton / Default for initialization (prevents null checks everywhere)
// 1. Skeleton Replacement
const SKELETON_PERFUME = {
  brand: "?????" as string,
  concentration: undefined as string | undefined, // Starts undefined
  gender: "?????", // Fallback
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

// ... inside GameProvider ...


export type AttemptFeedback = {
  brandMatch: boolean;
  notesMatch: number;
  perfumerMatch: "full" | "partial" | "none";
  yearDirection: "higher" | "lower" | "equal";
  yearMatch: "correct" | "close" | "wrong";
};

export type Attempt = {
  brand: string;
  concentration?: string;
  feedback: AttemptFeedback;
  gender?: string;
  guess: string;
  isCorrect?: boolean;
  perfumeId?: string; // Added ID for strict deduplication
  perfumers?: string[];
  snapshot?: {
    brandRevealed: boolean;
    genderRevealed: boolean;
    guessMaskedBrand: string;
    guessMaskedYear: string;
    yearRevealed: boolean;
  };
  year?: number;
};

type GameState = "playing" | "won" | "lost";

type GameContextType = {
  attempts: Attempt[];
  currentAttempt: number;
  dailyPerfume: typeof SKELETON_PERFUME;
  gameState: GameState;
  getBlurLevel: () => number;
  getPotentialScore: () => number;
  getRevealedBrand: () => string;
  getRevealedGender: () => string;
  getRevealedPerfumer: () => string;
  getRevealedYear: () => string;
  getVisibleNotes: () => {
    base: string[] | null;
    heart: string[] | null;
    top: string[] | null;
  };
  isBrandRevealed: boolean;
  isGenderRevealed: boolean;
  isYearRevealed: boolean;
  loading: boolean;
  makeGuess: (perfumeName: string, brand: string, perfumeId: string) => void;
  maxAttempts: number;
  resetGame: () => Promise<void>;
  revealLevel: number;
  sessionId: string | null;
  toggleFontScale: () => void;

  toggleLayoutMode: () => void;
  toggleTheme: () => void;
  // UI Preferences
  uiPreferences: {
    fontScale: "normal" | "large";
    layoutMode: "narrow" | "wide";
    theme: "light" | "dark";
  };
  xsolveScore: number;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

/**
 *
 */
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

// Local revealLetters definition removed. Using imported version.

/**
 *
 * @param root0
 * @param root0.children
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog();
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

  const [nonce, setNonce] = useState<string>(""); // Add nonce state
  const maxAttempts = MAX_GUESSES;

  // UI Preferences State
  const [layoutMode, setLayoutMode] = useState<"narrow" | "wide">("narrow");
  const [fontScale, setFontScale] = useState<"normal" | "large">("normal");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode((previous) => {
      const next = previous === "narrow" ? "wide" : "narrow";
      localStorage.setItem("fragrance-game-layout", next);
      return next;
    });
  }, []);

  const toggleFontScale = useCallback(() => {
    setFontScale((previous) => {
      const next = previous === "normal" ? "large" : "normal";
      localStorage.setItem("fragrance-game-font", next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      const next = previous === "light" ? "dark" : "light";
      localStorage.setItem("fragrance-game-theme", next);
      return next;
    });
  }, []);

  // Apply Theme & Font Scale Side Effects
  useEffect(() => {
    // Theme
    document.documentElement.classList.toggle("dark", theme === "dark");

    // Font Scale (on HTML to scale rems globally)
    document.documentElement.classList.toggle("large-text", fontScale === "large");
  }, [theme, fontScale]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem("fragrance-game-layout") as
      | "narrow"
      | "wide";
    if (savedLayout) {
      setLayoutMode(savedLayout);
    } else if (window.innerWidth >= 1024) {
      // Default to wide on desktop if no preference saved
      setLayoutMode("wide");
    }

    const savedFont = localStorage.getItem("fragrance-game-font") as
      | "normal"
      | "large";
    if (savedFont) setFontScale(savedFont);

    const savedTheme = localStorage.getItem("fragrance-game-theme") as
      | "light"
      | "dark";
    if (savedTheme) setTheme(savedTheme);
  }, []);

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

        if (!existingSession) {
          console.log("[GameProvider] No session, signing in anonymously...");
          const { error: authError } = await supabase.auth.signInAnonymously();
          if (authError) {
            console.error("Anonymous auth failed:", authError);
            return;
          }

          // Verification loop: Ensure session is actually set in the client state AND cookies
          let verified = false;
          for (let i = 0; i < 10; i++) {
            const {
              data: { session: s },
            } = await supabase.auth.getSession();

            // Check if cookie is present (Server Actions rely on this!)
            const hasCookie = document.cookie.includes("sb-") && document.cookie.includes("-auth-token");

            if (s && hasCookie) {
              console.log("[GameProvider] Auth session & cookie verified on attempt", i + 1);
              verified = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          if (!verified) {
            console.warn("[GameProvider] Auth session not verified after 5 attempts.");
          }
        }

        // 2. Fetch challenge and start game in ONE server call (reduces round-trips)
        let { challenge, session } = await initializeGame();

        // 2b. If we got challenge but NO session (Unauthorized retry)
        // This happens if the server action is called slightly before cookies are processed
        if (challenge && !session) {
          console.warn("[GameProvider] Got challenge but no session. Retrying session creation...");
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
      } catch (error) {
        console.error("Failed to init game", error);
      } finally {
        clearTimeout(safetyTimeout);
        console.log("[GameProvider] initGame finished");
        setLoading(false);
      }
    };
    initGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const answerPerfumers = new Set(dailyPerfume.perfumer
          .split(",")
          .map((p) => p.trim().toLowerCase()));

        for (const p of guessPerfumers) {
          if (answerPerfumers.has(p.trim().toLowerCase())) {
            const originalName = dailyPerfume.perfumer
              .split(",")
              .find((n) => n.trim().toLowerCase() === p.trim().toLowerCase());
            if (originalName) newDiscovered.add(originalName.trim());
          }
        }

        if (attempt.feedback.perfumerMatch === "full") {
          for (const p of dailyPerfume.perfumer
            .split(",")) newDiscovered.add(p.trim());
        }
      }
    }
    setDiscoveredPerfumers(newDiscovered);
  }, [attempts, dailyPerfume.perfumer]);

  // Merge dynamic image into the daily perfume object
  const activePerfume = { ...dailyPerfume, imageUrl };

  const currentAttempt = attempts.length + 1;
  const revealLevel = Math.min(currentAttempt, maxAttempts);

  const getRevealedBrandHelper = (currentLevel: number) => {
    const isGameOver = gameState === "won" || gameState === "lost";
    // Logic extraction for consistency if needed, but we keep simple
    if (currentLevel === 1) return "?????";
    const percentages = [0, 0, 0.15, 0.4, 0.7, 1];
    return revealLetters(
      dailyPerfume.brand,
      percentages[Math.min(currentLevel - 1, 5)],
    );
  };

  const getRevealedYearHelper = (currentLevel: number) => {
    // Level 1 (0 att): ____
    if (currentLevel >= 5) return dailyPerfume.year.toString();
    if (currentLevel === 4)
      return dailyPerfume.year.toString().slice(0, 3) + "_";
    if (currentLevel === 3)
      return dailyPerfume.year.toString().slice(0, 2) + "__";
    if (currentLevel === 2)
      return dailyPerfume.year.toString().slice(0, 1) + "___";
    return "____";
  };

  // --- Snapshot Helper (DRY) ---
  // --- Snapshot Helper (DRY) ---
  const calculateMaskedValues = (
    level: number,
    targetBrand: string,
    targetYear: number | string,
  ) => {
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
      else switch (level) {
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
  };

  // NEW HELPERS FOR LOG REVEAL (Moved up for dependency usage)
  const isBrandRevealed =
    attempts.some((a) => a.feedback.brandMatch) ||
    getRevealedBrandHelper(revealLevel) === dailyPerfume.brand;

  const isYearRevealed =
    attempts.some((a) => a.feedback.yearMatch === "correct") ||
    getRevealedYearHelper(revealLevel) === dailyPerfume.year.toString();

  const isGenderRevealed = attempts.some(
    (a) =>
      a.snapshot?.genderRevealed ||
      a.gender?.toLowerCase() === dailyPerfume.gender.toLowerCase(),
  );

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

        // Use server feedback (proper implementation)
        const feedback = result.feedback;

        // Calculate snapshot state BEFORE adding this attempt (isXRevealed is based on previous attempts)
        // Check if THIS guess reveals anything new
        const thisBrandRevealed =
          brand.toLowerCase() === dailyPerfume.brand.toLowerCase();
        const thisYearRevealed =
          String(result.guessedPerfumeDetails?.year) ===
          String(dailyPerfume.year);
        // Assume gender match if available, otherwise strict check?
        // We rely on dailyPerfume.gender comparison.
        const thisGenderRevealed =
          result.guessedPerfumeDetails?.gender?.toLowerCase() ===
          dailyPerfume.gender.toLowerCase();

        const snapshot = {
          brandRevealed: isBrandRevealed || thisBrandRevealed,
          // We need a getter for current gender revealed state similar to others
          genderRevealed:
            attempts.some((a) => a.snapshot?.genderRevealed) ||
            thisGenderRevealed, // simplified "isGenderRevealed" check
          yearRevealed: isYearRevealed || thisYearRevealed,
          // Better: use the helper implementation logic inline or ensure isGenderRevealed is updated
        };
        // Correction: referencing `isGenderRevealed` inside makeGuess (which uses useCallback) might satisfy if dependency correct.
        // But `makeGuess` has explicit dependencies.
        // Let's re-calculate "current global state" inside here to be safe, or optimize.
        // Actually, we can define `isGenderRevealed` variable inside render and use it.
        // However, `attempts` is in dependency.
        const currentGenderRevealed =
          attempts.some((a) => {
            // For past attempts, we assume they store if they revealed it,
            // OR we check if they matched.
            // Ideally we check if ANY previous attempt matched gender.
            // We don't store genderMatch in feedback currently?
            // We need gender in Attempt to check? Or just trust snapshot?
            return (
              a.snapshot?.genderRevealed || (a.year === undefined && false)
            ); // Fallback
            // Wait, standardizing:
          }) || false;

        // Let's rely on robust logic:
        const guessGender = result.guessedPerfumeDetails?.gender;
        const matchedGender =
          guessGender?.toLowerCase() === dailyPerfume.gender.toLowerCase();

        // We need to know if it was ALREADY revealed.
        // `isGenderRevealed` from context/scope.
        const wasGenderRevealed = attempts.some((a) => {
          // Check if any previous attempt matched gender
          // We don't strictly have gender in Attempt unless we add it or infer from snapshot.
          // But we can check `snapshot.genderRevealed`.
          return a.snapshot?.genderRevealed;
        });

        // Calculate snapshot state INCLUDING the effect of the current attempt (level increment)
        const nextAttemptsCount = attempts.length + 1;

        // Calculate Clues for Snapshot (Use GUESS values)
        const { guessMaskedBrand, guessMaskedYear } = calculateMaskedValues(
          nextAttemptsCount,
          brand,
          result.guessedPerfumeDetails?.year || 0,
        );

        // Check Reveal Status for Global State (Use ANSWER values)
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
          // Store gender for history if needed, though mostly for snapshot
          gender: result.guessedPerfumeDetails?.gender,
          guess: perfumeName,
          isCorrect: result.result === "correct",
          perfumeId: perfumeId, // Store ID
          perfumers: result.guessedPerfumers,

          snapshot: newSnapshot,
          year: result.guessedPerfumeDetails?.year,
        };

        setAttempts((previous) => [...previous, newAttempt]);

        if (result.answerName) {
          setDailyPerfume((previous) => ({
            ...previous,
            // Fix: Use answerConcentration if provided (covers both win and loss scenarios correctly)
            concentration: result.answerConcentration,
            name: result.answerName!,
          }));
        }

        if (result.gameStatus === "won") {
          setGameState("won");
          // FIX: Force set reveal image on win
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
    ],
  );

  const handleReset = useCallback(async () => {
    if (!sessionId) {
      console.warn("[GameProvider] No session to reset");
      return;
    }

    try {
      setLoading(true);
      // 1. Call server action to delete session
      const result = await resetGame(sessionId);

      if (result.success) {
        // 2. Clear all local state immediately
        setAttempts([]);
        setGameState("playing");
        setNonce("");
        setSessionId(null);
        setDailyPerfume(SKELETON_PERFUME);
        setImageUrl("/placeholder.svg"); // Temporary clear
        setDiscoveredPerfumers(new Set());

        // 3. Force a substantial delay to let React process the clear and ensure no racer with server
        await new Promise((resolve) => setTimeout(resolve, 150));

        // 4. Reinitialize game from scratch using the optimized single-call function
        const { challenge, session } = await initializeGame();

        if (challenge && session) {
          // Re-setup skeleton with new challenge data (but still masked)
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

          // Add a one-time cache buster for the reset to override any browser stubbornness
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
  }, [sessionId]);

  const getRevealedBrand = useCallback(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver || attempts.some((a) => a.feedback.brandMatch))
      return dailyPerfume.brand;

    if (revealLevel === 1) return "?????";

    // Levels: 1(___), 2(0%), 3(15%), 4(40%), 5(70%), 6(100%)
    const percentages = [0, 0, 0.15, 0.4, 0.7, 1];
    return revealLetters(
      dailyPerfume.brand,
      percentages[Math.min(revealLevel - 1, 5)],
    );
  }, [revealLevel, dailyPerfume.brand, attempts, gameState]);

  const getRevealedPerfumer = useCallback(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver) return dailyPerfume.perfumer;

    const perfumers = dailyPerfume.perfumer.split(",").map((p) => p.trim());

    if (attempts.some((a) => a.feedback.perfumerMatch === "full"))
      return dailyPerfume.perfumer;

    // Check coverage
    if (perfumers.every((p) => discoveredPerfumers.has(p)))
      return dailyPerfume.perfumer;

    if (revealLevel === 1) return "?????";

    return perfumers
      .map((p) => {
        if (discoveredPerfumers.has(p)) return p;
        // Progressive fallback
        const percentages = [0, 0, 0.1, 0.3, 0.6, 1];
        return revealLetters(p, percentages[Math.min(revealLevel - 1, 5)]);
      })
      .join(", ");
  }, [
    revealLevel,
    dailyPerfume.perfumer,
    discoveredPerfumers,
    attempts,
    gameState,
  ]);

  const getRevealedYear = useCallback(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver || attempts.some((a) => a.feedback.yearMatch === "correct"))
      return dailyPerfume.year.toString();

    const year = dailyPerfume.year.toString();

    // Level 1 (0 att): ____
    // Level 2 (1 att): 1___
    // Level 3 (2 att): 19__
    // Level 4 (3 att): 197_
    // Level 5 (4 att): 1979 (Full)
    // Level 6 (5 att): 1979 (Full)

    if (revealLevel >= 5) return year; // Changed from 4 to 5 for full reveal
    if (revealLevel === 4) return year.slice(0, 3) + "_";
    if (revealLevel === 3) return year.slice(0, 2) + "__";
    if (revealLevel === 2) return year.slice(0, 1) + "___";
    return "____"; // Level 1
  }, [revealLevel, dailyPerfume.year, attempts, gameState]);

  // NEW HELPERS FOR LOG REVEAL (Issue #5) - MOVED UP
  // Keeping these declarations here would cause shadowing or unused vars if we didn't remove them.
  // We removed them from here and put them before makeGuess.
  // Logic is preserved.

  const getRevealedGender = useCallback(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver || isGenderRevealed) return dailyPerfume.gender;
    return "Unknown"; // Or masked? Plan says "Reveal Gender on Game Over"
  }, [gameState, isGenderRevealed, dailyPerfume.gender]);

  // Removed getVisibleAccords

  const getVisibleNotes = useCallback(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    const hasPerfectNotes = attempts.some((a) => a.feedback.notesMatch >= 1);

    if (isGameOver || hasPerfectNotes) {
      return {
        base: dailyPerfume.notes.base,
        heart: dailyPerfume.notes.heart,
        top: dailyPerfume.notes.top,
      };
    }

    // New Progression:
    // Level 1: ••• (Generic)
    // Level 2: Masked Strings (0% revealed letters)
    // Level 3: Top Revealed, Heart/Base Masked
    // Level 4: Top+Heart Revealed, Base Masked
    // Level 5+: All Revealed

    const mask = (notes: string[]) => notes.map((n) => revealLetters(n, 0)); // 0% reveal -> masked strings

    if (revealLevel >= 5) {
      return {
        base: dailyPerfume.notes.base,
        heart: dailyPerfume.notes.heart,
        top: dailyPerfume.notes.top,
      };
    }

    if (revealLevel === 4) {
      // Top REVEALED, Heart REVEALED, Base MASKED
      return {
        base: mask(dailyPerfume.notes.base || []),
        heart: dailyPerfume.notes.heart,
        top: dailyPerfume.notes.top,
      };
    }

    if (revealLevel === 3) {
      // Top REVEALED, Heart MASKED, Base MASKED
      return {
        base: mask(dailyPerfume.notes.base || []),
        heart: mask(dailyPerfume.notes.heart || []),
        top: dailyPerfume.notes.top,
      };
    }

    if (revealLevel === 2) {
      // All MASKED STRINGS
      return {
        base: mask(dailyPerfume.notes.base || []),
        heart: mask(dailyPerfume.notes.heart || []),
        top: mask(dailyPerfume.notes.top || []),
      };
    }

    if (revealLevel === 1) {
      return {
        base: ["?????", "?????", "?????"],
        heart: ["?????", "?????", "?????"],
        top: ["?????", "?????", "?????"],
      };
    }
    return { base: null, heart: null, top: null };
  }, [revealLevel, dailyPerfume.notes, gameState, attempts]);

  const getBlurLevel = useCallback(() => {
    const isGameOver = gameState === "won" || gameState === "lost";
    if (isGameOver) return 0;
    // 6 levels of blur matching table
    const blurLevels = [10, 9.5, 8.5, 7.5, 6, 0];
    return blurLevels[Math.min(revealLevel - 1, 5)];
  }, [revealLevel, gameState]);

  const getPotentialScore = useCallback(() => {
    const baseScores = [1000, 700, 490, 343, 240, 168];
    return baseScores[Math.min(currentAttempt - 1, 5)];
  }, [currentAttempt]);

  return (
    <GameContext.Provider
      value={{
        attempts,
        currentAttempt,
        dailyPerfume: activePerfume,
        gameState,
        getBlurLevel,
        getPotentialScore,
        getRevealedBrand,
        getRevealedGender: () => dailyPerfume.gender || "Unisex",
        getRevealedPerfumer,
        getRevealedYear,
        // getVisibleAccords removed
        getVisibleNotes,
        isBrandRevealed,
        isGenderRevealed,
        isYearRevealed,
        loading,
        makeGuess,
        maxAttempts,
        resetGame: handleReset,
        revealLevel,
        sessionId,
        toggleFontScale,
        toggleLayoutMode,
        toggleTheme,
        uiPreferences: { fontScale, layoutMode, theme },
        xsolveScore: dailyPerfume.xsolve,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
