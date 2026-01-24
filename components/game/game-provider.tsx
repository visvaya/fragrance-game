"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { usePostHog } from 'posthog-js/react'
import { getDailyChallenge, startGame, submitGuess, resetGame, type DailyChallenge } from "@/app/actions/game-actions"
import { createClient } from "@/lib/supabase/client"
import { MAX_GUESSES } from "@/lib/constants"
import { revealLetters } from "@/lib/game/scoring"

// Skeleton / Default for initialization (prevents null checks everywhere)
const SKELETON_PERFUME = {
  id: "skeleton",
  name: "•••" as string,
  brand: "•••" as string,
  perfumer: "•••" as string,
  year: "•••" as string | number,
  concentration: undefined as string | undefined,
  gender: "•••" as string, // Fallback
  notes: {
    top: ["•••", "•••", "•••"],
    heart: ["•••", "•••", "•••"],
    base: ["•••", "•••", "•••"],
  },
  isLinear: false as boolean,
  xsolve: 0 as number,
  imageUrl: "/placeholder.svg?height=400&width=400",
}

export type AttemptFeedback = {
  brandMatch: boolean
  perfumerMatch: "full" | "partial" | "none"
  yearMatch: "correct" | "close" | "wrong"
  yearDirection: "higher" | "lower" | "equal"
  notesMatch: number
}

export type Attempt = {
  guess: string
  perfumeId?: string // Added ID for strict deduplication
  brand: string
  year?: number
  concentration?: string
  gender?: string
  perfumers?: string[]
  feedback: AttemptFeedback
  snapshot?: {
    brandRevealed: boolean
    yearRevealed: boolean
    genderRevealed: boolean
  }
}

type GameState = "playing" | "won" | "lost"

type GameContextType = {
  currentAttempt: number
  maxAttempts: number
  attempts: Attempt[]
  gameState: GameState
  revealLevel: number
  dailyPerfume: typeof SKELETON_PERFUME
  makeGuess: (perfumeName: string, brand: string, perfumeId: string) => void
  getRevealedBrand: () => string
  getRevealedPerfumer: () => string
  getRevealedYear: () => string
  getVisibleNotes: () => { top: string[] | null; heart: string[] | null; base: string[] | null }
  getBlurLevel: () => number
  getPotentialScore: () => number
  sessionId: string | null
  resetGame: () => Promise<void>
  isBrandRevealed: boolean
  isYearRevealed: boolean
  isGenderRevealed: boolean
  getRevealedGender: () => string
  xsolveScore: number
}

const GameContext = createContext<GameContextType | null>(null)

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error("useGame must be used within a GameProvider")
  }
  return context
}

// Local revealLetters definition removed. Using imported version.

export function GameProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog()
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [gameState, setGameState] = useState<GameState>("playing")
  const [imageUrl, setImageUrl] = useState<string>("/placeholder.svg?height=400&width=400")
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [dailyPerfume, setDailyPerfume] = useState<typeof SKELETON_PERFUME>(SKELETON_PERFUME)
  const [discoveredPerfumers, setDiscoveredPerfumers] = useState<Set<string>>(new Set())

  const [nonce, setNonce] = useState<string>("") // Add nonce state
  const maxAttempts = MAX_GUESSES

  // Initialize Game (with proper auth sequencing)
  useEffect(() => {
    const initGame = async () => {
      try {
        // 1. Ensure Auth (Anonymous) - MUST complete before any DB operations
        const supabase = createClient()
        const { data: { session: existingSession } } = await supabase.auth.getSession()

        if (!existingSession) {
          const { error: authError } = await supabase.auth.signInAnonymously()
          if (authError) {
            console.error("Anonymous auth failed:", authError)
            return // Exit early if auth fails
          }
        }

        // 2. Fetch challenge and start game (only after auth is guaranteed)
        const challenge = await getDailyChallenge()
        if (challenge) {
          posthog.capture('daily_challenge_viewed', { challenge_number: challenge.id })

          // Setup Daily Perfume Clues
          if (challenge.clues) {
            setDailyPerfume({
              id: "daily",
              name: "Mystery Perfume", // Name is secret!
              brand: challenge.clues.brand,
              perfumer: challenge.clues.perfumer,
              year: challenge.clues.year,
              gender: challenge.clues.gender,
              notes: challenge.clues.notes,
              isLinear: challenge.clues.isLinear,
              xsolve: challenge.clues.xsolve,
              imageUrl: "/placeholder.svg", // Will be overwritten by session
              concentration: undefined
            });
          }

          const session = await startGame(challenge.id)
          setSessionId(session.sessionId)
          setNonce(session.nonce) // Store nonce
          if (session.imageUrl) {
            setImageUrl(session.imageUrl)
          }

          // Hydrate Attempts
          if (session.guesses && session.guesses.length > 0) {
            const enrichedAttempts: Attempt[] = session.guesses.map(g => {
              const isCorrect = g.isCorrect;
              // For hydrating feedback, if we don't have detailed diff from server in StartGameResponse,
              // we can infer rudimentary feedback or wait for a better implementation.
              // For now, if "isCorrect" is true, everything is matched.
              // If false, we can't easily know "close" matches without storing diffs in DB.
              // Let's assume partial/wrong for now unless correct.
              // BETTER: Compare with challenge.clues which we just fetched!

              const brandMatch = g.brandName.toLowerCase() === challenge.clues.brand.toLowerCase();

              return {
                guess: g.perfumeName,
                perfumeId: g.perfumeId, // Map ID from history
                brand: g.brandName,
                feedback: {
                  brandMatch,
                  perfumerMatch: isCorrect ? "full" : "none", // approximated
                  yearMatch: isCorrect ? "correct" : "wrong", // approximated
                  yearDirection: "equal", // basic fallback
                  notesMatch: isCorrect ? 1 : 0 // approximated
                },
                year: g.year,
                concentration: g.concentration
              };
            });
            setAttempts(enrichedAttempts);

            const lastGuess = session.guesses[session.guesses.length - 1];
            if (lastGuess.isCorrect) setGameState("won");
            else if (session.guesses.length >= maxAttempts) setGameState("lost");
          }
        }
      } catch (e) {
        console.error("Failed to init game", e)
      } finally {
        setLoading(false)
      }
    }
    initGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track discovered perfumers
  useEffect(() => {
    const newDiscovered = new Set<string>();
    attempts.forEach(attempt => {
      if (attempt.feedback.perfumerMatch === "full" || attempt.feedback.perfumerMatch === "partial") {
        const guessPerfumers = attempt.perfumers || [];
        const answerPerfumers = dailyPerfume.perfumer.split(',').map(p => p.trim().toLowerCase());

        guessPerfumers.forEach(p => {
          if (answerPerfumers.includes(p.trim().toLowerCase())) {
            const originalName = dailyPerfume.perfumer.split(',').find(n => n.trim().toLowerCase() === p.trim().toLowerCase());
            if (originalName) newDiscovered.add(originalName.trim());
          }
        });

        if (attempt.feedback.perfumerMatch === "full") {
          dailyPerfume.perfumer.split(',').forEach(p => newDiscovered.add(p.trim()));
        }
      }
    });
    setDiscoveredPerfumers(newDiscovered);
  }, [attempts, dailyPerfume.perfumer]);

  // Merge dynamic image into the daily perfume object
  const activePerfume = { ...dailyPerfume, imageUrl }

  const currentAttempt = attempts.length + 1
  const revealLevel = Math.min(currentAttempt, maxAttempts)

  const getRevealedBrandHelper = (currentLevel: number) => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    // Logic extraction for consistency if needed, but we keep simple
    if (currentLevel === 1) return "•••";
    const percentages = [0, 0, 0.15, 0.40, 0.70, 1.0];
    return revealLetters(dailyPerfume.brand, percentages[Math.min(currentLevel - 1, 5)])
  };

  const getRevealedYearHelper = (currentLevel: number) => {
    // Level 1 (0 att): ••••
    if (currentLevel >= 5) return dailyPerfume.year.toString();
    if (currentLevel === 4) return dailyPerfume.year.toString().slice(0, 3) + "•";
    if (currentLevel === 3) return dailyPerfume.year.toString().slice(0, 2) + "••";
    if (currentLevel === 2) return dailyPerfume.year.toString().slice(0, 1) + "•••";
    return "••••";
  }

  // NEW HELPERS FOR LOG REVEAL (Moved up for dependency usage)
  const isBrandRevealed = attempts.some(a => a.feedback.brandMatch) ||
    getRevealedBrandHelper(revealLevel) === dailyPerfume.brand;

  const isYearRevealed = attempts.some(a => a.feedback.yearMatch === "correct") ||
    getRevealedYearHelper(revealLevel) === dailyPerfume.year.toString();

  const isGenderRevealed = attempts.some(a =>
    a.snapshot?.genderRevealed || a.gender?.toLowerCase() === dailyPerfume.gender.toLowerCase()
  );


  const makeGuess = useCallback(
    async (perfumeName: string, brand: string, perfumeId: string) => {
      if (gameState !== "playing" || attempts.length >= maxAttempts || !sessionId) return

      try {
        const result = await submitGuess(sessionId, perfumeId, nonce)

        if (result.imageUrl) {
          setImageUrl(result.imageUrl)
        }

        if (result.newNonce) {
          setNonce(result.newNonce)
        }

        // Use server feedback (proper implementation)
        const feedback = result.feedback

        // Calculate snapshot state BEFORE adding this attempt (isXRevealed is based on previous attempts)
        // Check if THIS guess reveals anything new
        const thisBrandRevealed = brand.toLowerCase() === dailyPerfume.brand.toLowerCase();
        const thisYearRevealed = String(result.guessedPerfumeDetails?.year) === String(dailyPerfume.year);
        // Assume gender match if available, otherwise strict check? 
        // We rely on dailyPerfume.gender comparison.
        const thisGenderRevealed = result.guessedPerfumeDetails?.gender?.toLowerCase() === dailyPerfume.gender.toLowerCase();

        const snapshot = {
          brandRevealed: isBrandRevealed || thisBrandRevealed,
          yearRevealed: isYearRevealed || thisYearRevealed,
          // We need a getter for current gender revealed state similar to others
          genderRevealed: attempts.some(a => a.snapshot?.genderRevealed) || thisGenderRevealed // simplified "isGenderRevealed" check
          // Better: use the helper implementation logic inline or ensure isGenderRevealed is updated
        };
        // Correction: referencing `isGenderRevealed` inside makeGuess (which uses useCallback) might satisfy if dependency correct.
        // But `makeGuess` has explicit dependencies. 
        // Let's re-calculate "current global state" inside here to be safe, or optimize.
        // Actually, we can define `isGenderRevealed` variable inside render and use it.
        // However, `attempts` is in dependency.
        const currentGenderRevealed = attempts.some(a => {
          // For past attempts, we assume they store if they revealed it, 
          // OR we check if they matched.
          // Ideally we check if ANY previous attempt matched gender.
          // We don't store genderMatch in feedback currently?
          // We need gender in Attempt to check? Or just trust snapshot?
          return a.snapshot?.genderRevealed || (a.year === undefined && false); // Fallback
          // Wait, standardizing:
        }) || false;

        // Let's rely on robust logic:
        const guessGender = result.guessedPerfumeDetails?.gender;
        const matchedGender = guessGender?.toLowerCase() === dailyPerfume.gender.toLowerCase();

        // We need to know if it was ALREADY revealed.
        // `isGenderRevealed` from context/scope.
        const wasGenderRevealed = attempts.some(a => {
          // Check if any previous attempt matched gender
          // We don't strictly have gender in Attempt unless we add it or infer from snapshot.
          // But we can check `snapshot.genderRevealed`.
          return a.snapshot?.genderRevealed;
        });

        const newSnapshot = {
          brandRevealed: isBrandRevealed || thisBrandRevealed,
          yearRevealed: isYearRevealed || thisYearRevealed,
          genderRevealed: wasGenderRevealed || matchedGender
        };

        const newAttempt: Attempt = {
          guess: perfumeName,
          perfumeId: perfumeId, // Store ID
          brand,
          perfumers: result.guessedPerfumers,
          year: result.guessedPerfumeDetails?.year,
          concentration: result.guessedPerfumeDetails?.concentration,
          feedback,
          snapshot: newSnapshot,
          // Store gender for history if needed, though mostly for snapshot
          gender: result.guessedPerfumeDetails?.gender
        }

        setAttempts((prev) => [...prev, newAttempt])

        if (result.answerName) {
          setDailyPerfume(prev => ({
            ...prev,
            name: result.answerName!,
            // If the last guess was correct (game won), its concentration is likely the answer's concentration
            concentration: result.gameStatus === 'won' ? result.guessedPerfumeDetails?.concentration : prev.concentration
          }));
        }

        if (result.gameStatus === 'won') {
          setGameState("won")
          // FIX: Force set reveal image on win
          if (result.imageUrl) {
            setImageUrl(result.imageUrl)
          }
        } else if (attempts.length + 1 >= maxAttempts) {
          setGameState("lost")
        }

      } catch (error) {
        console.error("Guess submission failed:", error)
      }
    },
    [attempts, gameState, maxAttempts, sessionId, nonce, dailyPerfume, isBrandRevealed, isYearRevealed],
  )

  const handleReset = useCallback(async () => {
    if (!sessionId) {
      console.warn('[GameProvider] No session to reset');
      return;
    }

    try {
      setLoading(true);
      // 1. Call server action to delete session
      const result = await resetGame(sessionId);

      if (result.success) {
        // 2. Clear all local state immediately
        setAttempts([]);
        setGameState('playing');
        setNonce('');
        setSessionId(null);
        setDailyPerfume(SKELETON_PERFUME);
        setImageUrl('/placeholder.svg'); // Temporary clear
        setDiscoveredPerfumers(new Set());

        setDiscoveredPerfumers(new Set());

        // 3. Force a substantial delay to let React process the clear and ensure no racer with server
        await new Promise(resolve => setTimeout(resolve, 150));

        // 4. Reinitialize game from scratch
        const challenge = await getDailyChallenge();
        if (challenge) {
          // Re-setup skeleton with new challenge data (but still masked)
          setDailyPerfume({
            id: "daily",
            name: "Mystery Perfume",
            brand: challenge.clues.brand,
            perfumer: challenge.clues.perfumer,
            year: challenge.clues.year,
            gender: challenge.clues.gender,
            notes: challenge.clues.notes,
            isLinear: challenge.clues.isLinear,
            xsolve: challenge.clues.xsolve,
            imageUrl: "/placeholder.svg",
            concentration: undefined
          });

          // Start fresh session
          const newSession = await startGame(challenge.id);

          if (newSession) {
            setSessionId(newSession.sessionId);
            setNonce(newSession.nonce);

            // Add a one-time cache buster for the reset to override any browser stubbornness
            const busterUrl = newSession.imageUrl ? `${newSession.imageUrl}?reset=${Date.now()}` : '/placeholder.svg';
            setImageUrl(busterUrl);
          }
        }
      } else {
        console.error('[GameProvider] Reset backend action failed.');
      }
    } catch (e) {
      console.error('[GameProvider] Reset failed with error:', e);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);


  const getRevealedBrand = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    if (isGameOver || attempts.some(a => a.feedback.brandMatch)) return dailyPerfume.brand;

    if (revealLevel === 1) return "•••";

    // Levels: 1(•••), 2(0%), 3(15%), 4(40%), 5(70%), 6(100%)
    const percentages = [0, 0, 0.15, 0.40, 0.70, 1.0];
    return revealLetters(dailyPerfume.brand, percentages[Math.min(revealLevel - 1, 5)])
  }, [revealLevel, dailyPerfume.brand, attempts, gameState])

  const getRevealedPerfumer = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    if (isGameOver) return dailyPerfume.perfumer;

    const perfumers = dailyPerfume.perfumer.split(',').map(p => p.trim());

    if (attempts.some(a => a.feedback.perfumerMatch === "full")) return dailyPerfume.perfumer;

    // Check coverage
    if (perfumers.every(p => discoveredPerfumers.has(p))) return dailyPerfume.perfumer;

    if (revealLevel === 1) return "•••";

    return perfumers.map(p => {
      if (discoveredPerfumers.has(p)) return p;
      // Progressive fallback
      const percentages = [0, 0, 0.10, 0.30, 0.60, 1.0];
      return revealLetters(p, percentages[Math.min(revealLevel - 1, 5)]);
    }).join(', ');
  }, [revealLevel, dailyPerfume.perfumer, discoveredPerfumers, attempts, gameState])

  const getRevealedYear = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    if (isGameOver || attempts.some(a => a.feedback.yearMatch === "correct")) return dailyPerfume.year.toString();

    const year = dailyPerfume.year.toString();

    // Level 1 (0 att): ••••
    // Level 2 (1 att): 1•••
    // Level 3 (2 att): 19••
    // Level 4 (3 att): 197•
    // Level 5 (4 att): 1979 (Full)
    // Level 6 (5 att): 1979 (Full)

    if (revealLevel >= 5) return year; // Changed from 4 to 5 for full reveal
    if (revealLevel === 4) return year.slice(0, 3) + "•";
    if (revealLevel === 3) return year.slice(0, 2) + "••";
    if (revealLevel === 2) return year.slice(0, 1) + "•••";
    return "••••"; // Level 1
  }, [revealLevel, dailyPerfume.year, attempts, gameState])

  // NEW HELPERS FOR LOG REVEAL (Issue #5) - MOVED UP
  // Keeping these declarations here would cause shadowing or unused vars if we didn't remove them.
  // We removed them from here and put them before makeGuess.
  // Logic is preserved.

  const getRevealedGender = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    if (isGameOver || isGenderRevealed) return dailyPerfume.gender;
    return "Unknown"; // Or masked? Plan says "Reveal Gender on Game Over"
  }, [gameState, isGenderRevealed, dailyPerfume.gender]);

  // Removed getVisibleAccords

  const getVisibleNotes = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    const hasPerfectNotes = attempts.some(a => a.feedback.notesMatch >= 1.0);

    if (isGameOver || hasPerfectNotes) {
      return { top: dailyPerfume.notes.top, heart: dailyPerfume.notes.heart, base: dailyPerfume.notes.base };
    }

    // New Progression:
    // Level 1: ••• (Generic)
    // Level 2: Masked Strings (0% revealed letters)
    // Level 3: Top Revealed, Heart/Base Masked
    // Level 4: Top+Heart Revealed, Base Masked
    // Level 5+: All Revealed

    const mask = (notes: string[]) => notes.map(n => revealLetters(n, 0)); // 0% reveal -> masked strings

    if (revealLevel >= 5) {
      return { top: dailyPerfume.notes.top, heart: dailyPerfume.notes.heart, base: dailyPerfume.notes.base };
    }

    if (revealLevel === 4) {
      // Top REVEALED, Heart REVEALED, Base MASKED
      return {
        top: dailyPerfume.notes.top,
        heart: dailyPerfume.notes.heart,
        base: mask(dailyPerfume.notes.base || [])
      };
    }

    if (revealLevel === 3) {
      // Top REVEALED, Heart MASKED, Base MASKED
      return {
        top: dailyPerfume.notes.top,
        heart: mask(dailyPerfume.notes.heart || []),
        base: mask(dailyPerfume.notes.base || [])
      };
    }

    if (revealLevel === 2) {
      // All MASKED STRINGS
      return {
        top: mask(dailyPerfume.notes.top || []),
        heart: mask(dailyPerfume.notes.heart || []),
        base: mask(dailyPerfume.notes.base || [])
      };
    }

    // Level 1: Generic placeholer handled by UI (returning null) or we can return special strings?
    // Plan says: "Level 1: ••• (Generic)". 
    // If we return null, PyramidClues renders generic dots.
    return { top: null, heart: null, base: null };
    return { top: null, heart: null, base: null };
  }, [revealLevel, dailyPerfume.notes, gameState, attempts])

  const getBlurLevel = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    if (isGameOver) return 0;
    // 6 levels of blur matching table
    const blurLevels = [10, 9.5, 8.5, 7.5, 6, 0]
    return blurLevels[Math.min(revealLevel - 1, 5)]
  }, [revealLevel, gameState])

  const getPotentialScore = useCallback(() => {
    const baseScores = [1000, 700, 490, 343, 240, 168]
    return baseScores[Math.min(currentAttempt - 1, 5)]
  }, [currentAttempt])

  return (
    <GameContext.Provider
      value={{
        currentAttempt,
        maxAttempts,
        attempts,
        gameState,
        revealLevel,
        dailyPerfume: activePerfume,
        makeGuess,
        getRevealedBrand,
        getRevealedPerfumer,
        getRevealedYear,
        // getVisibleAccords removed
        getVisibleNotes,
        getBlurLevel,
        getPotentialScore,
        sessionId,
        resetGame: handleReset,
        xsolveScore: dailyPerfume.xsolve,
        isBrandRevealed,
        isYearRevealed,
        isGenderRevealed,
        getRevealedGender,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
