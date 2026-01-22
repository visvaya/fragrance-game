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
  name: "Loading...",
  brand: "Loading...",
  perfumer: "Loading...",
  year: 2024,
  gender: "Masculine", // Fallback
  notes: {
    top: ["?", "?", "?"],
    heart: ["?", "?", "?"],
    base: ["?", "?", "?"],
  },
  isLinear: false,
  xsolve: 0,
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
  brand: string
  year?: number
  concentration?: string
  perfumers?: string[]
  feedback: AttemptFeedback
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
              imageUrl: "/placeholder.svg" // Will be overwritten by session
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
  }, [])

  // Track discovered perfumers
  useEffect(() => {
    const newDiscovered = new Set(discoveredPerfumers);
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

        const newAttempt: Attempt = {
          guess: perfumeName,
          brand,
          perfumers: result.guessedPerfumers,
          year: result.guessedPerfumeDetails?.year,
          concentration: result.guessedPerfumeDetails?.concentration,
          feedback,
        }

        setAttempts((prev) => [...prev, newAttempt])

        if (result.gameStatus === 'won') {
          setGameState("won")
        } else if (attempts.length + 1 >= maxAttempts) {
          setGameState("lost")
        }

      } catch (error) {
        console.error("Guess submission failed:", error)
      }
    },
    [attempts.length, gameState, maxAttempts, sessionId, nonce, dailyPerfume.brand],
  )

  const handleReset = useCallback(async () => {
    if (!sessionId) {
      console.warn('No session to reset');
      return;
    }

    try {
      setLoading(true);

      // Call server action to delete session
      const result = await resetGame(sessionId);

      if (result.success) {
        // Clear all local state
        setAttempts([]);
        setGameState('playing');
        setNonce('');
        setSessionId(null);
        setImageUrl('/placeholder.svg');

        // Reinitialize game
        const challenge = await getDailyChallenge();
        if (challenge) {
          // Re-setup clues
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
            imageUrl: "/placeholder.svg"
          });

          // Start fresh session
          const newSession = await startGame(challenge.id);
          setSessionId(newSession.sessionId);
          setNonce(newSession.nonce);
          if (newSession.imageUrl) {
            setImageUrl(newSession.imageUrl);
          }
        }
      }
    } catch (e) {
      console.error('Reset failed:', e);
    } finally {
      // FIX ISSUE #12: Clear discovered perfumers on reset
      setDiscoveredPerfumers(new Set());
      setLoading(false);
    }
  }, [sessionId]);


  const getRevealedBrand = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    // Instant reveal if matched OR game over
    if (isGameOver || attempts.some(a => a.feedback.brandMatch)) return dailyPerfume.brand;

    if (revealLevel === 1) return "???";

    // Levels: 1(???), 2(0%), 3(15%), 4(40%), 5(70%), 6(100%)
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

    if (revealLevel === 1) return "???";

    return perfumers.map(p => {
      if (discoveredPerfumers.has(p)) return p;
      // Progressive fallback
      const percentages = [0, 0, 0.10, 0.30, 0.60, 1.0];
      return revealLetters(p, percentages[Math.min(revealLevel - 1, 5)]);
    }).join(', ');
  }, [revealLevel, dailyPerfume.perfumer, discoveredPerfumers, attempts, gameState])

  const getRevealedYear = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    // Instant reveal if matched
    if (isGameOver || attempts.some(a => a.feedback.yearMatch === "correct")) return dailyPerfume.year.toString();

    const year = dailyPerfume.year.toString()

    if (revealLevel >= 6) return year; // 100%
    if (revealLevel >= 5) return year.slice(0, 3) + "-"; // 75%
    if (revealLevel >= 4) return year.slice(0, 2) + "--"; // 50%
    if (revealLevel >= 3) return year.slice(0, 1) + "---"; // 25% (was 10% but 1 char is min)
    if (revealLevel >= 2) return year.slice(0, 1) + "---"; // Issue #17 table says: Att 2: 1--- ?? Wait.
    // Table:
    // Att 1: ----
    // Att 2: 1---
    // Att 3: 19--
    // Att 4: 197-
    // Att 5: Full? No, Att 5 is 70% radial? Year col says "full" at Att 5?
    // Table says: Att 5: "full", Att 6: "full".
    // Let's match Table strictly.
    if (revealLevel >= 5) return year;
    if (revealLevel === 4) return year.slice(0, 3) + "-";
    if (revealLevel === 3) return year.slice(0, 2) + "--";
    if (revealLevel === 2) return year.slice(0, 1) + "---";
    return "----"; // Level 1
  }, [revealLevel, dailyPerfume.year, attempts, gameState])

  // NEW HELPERS FOR LOG REVEAL (Issue #5)
  const isBrandRevealed = attempts.some(a => a.feedback.brandMatch) ||
    getRevealedBrand() === dailyPerfume.brand;

  const isYearRevealed = attempts.some(a => a.feedback.yearMatch === "correct") ||
    getRevealedYear() === dailyPerfume.year.toString();

  // Removed getVisibleAccords

  const getVisibleNotes = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    if (isGameOver) {
      return { top: dailyPerfume.notes.top, heart: dailyPerfume.notes.heart, base: dailyPerfume.notes.base };
    }
    // Level 1: only base (Wait. Plan says: Att 1: ???, Att 2: 0% Masked, Att 3: Base, Att 4: +Heart)
    // Table: 
    // Att 1: ???
    // Att 2: 0% (masked)
    // Att 3: Base notes (visible)
    // Att 4: +Heart notes
    // Att 5: +Top (Full)

    // So:
    if (revealLevel >= 5) {
      return { top: dailyPerfume.notes.top, heart: dailyPerfume.notes.heart, base: dailyPerfume.notes.base };
    }
    if (revealLevel === 4) {
      return { top: null, heart: dailyPerfume.notes.heart, base: dailyPerfume.notes.base };
    }
    if (revealLevel === 3) {
      return { top: null, heart: null, base: dailyPerfume.notes.base };
    }
    // Level 2 & 1 are handled implicitly by "null" logic in UI or empty?
    // Current logic returns 'null'. UI should handle null.
    // But Issue #17 says: Att 2 shows 0% masked notes.
    // If I return 'null', UI usually shows nothing or ??? placeholder.
    // In PyramidClues (modified earlier), if note is null/undefined, it shows •••.
    // But here I'm returning null for the ARRAY.
    // PyramidClues: `const levels = [{ notes: notes.top ... }]`.
    // If notes.top is null, `level.notes && level.notes.length`. Condition fails.
    // Render: `<span ...> • • • </span>`.
    // So if Level 2 is "0% masked", it implies we SEE that there are notes, but they are masked?
    // Or we see •••?
    // "0% (`•` masked)" implies `•••••`.
    // If I return null, PyramidClues renders "• • •".
    // That's CLOSE enough to "0% masked" for generic placeholder.
    // BUT "Att 2: 0% (`•` masked)" implies per-letter masking of real notes?
    // If so, I need to return MASKED STRINGS, not null.
    // Let's implement Masked Strings for Level 2.

    if (revealLevel === 2) {
      // Return masked version of notes
      const mask = (notes: string[]) => notes.map(n => revealLetters(n, 0));
      return {
        top: mask(dailyPerfume.notes.top || []),
        heart: mask(dailyPerfume.notes.heart || []),
        base: mask(dailyPerfume.notes.base || [])
      };
    }

    if (revealLevel === 1) {
      // Att 1: ??? string. This might need special string handling or just null -> ??? placeholder.
      // Table says: "???" (x3 levels).
      // If I return null, UI shows •••. I'll stick with null for Level 1, assuming UI "• • •" represents "???" well enough visually.
      return { top: null, heart: null, base: null };
    }

    return { top: null, heart: null, base: null };
  }, [revealLevel, dailyPerfume.notes, gameState])

  const getBlurLevel = useCallback(() => {
    const isGameOver = gameState === 'won' || gameState === 'lost';
    if (isGameOver) return 0;
    // 6 levels of blur: 32px -> 24px -> 16px -> 10px -> 4px -> 0px
    const blurLevels = [32, 24, 16, 10, 4, 0]
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
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
