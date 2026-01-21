"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { usePostHog } from 'posthog-js/react'
import { getDailyChallenge, startGame, submitGuess, resetGame, type DailyChallenge } from "@/app/actions/game-actions"
import { createClient } from "@/lib/supabase/client"
import { MAX_GUESSES } from "@/lib/constants"

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
  resetGame: () => Promise<void>;
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

// Utility function to reveal letters from center outward
function revealLetters(text: string, percentage: number): string {
  if (!text) return "";
  const separators = /[\s\-'.&]/
  const tokens = text.split(separators)
  const separatorMatches = text.match(separators) || []

  const totalLetters = tokens.reduce((sum, token) => sum + token.length, 0)
  const lettersToReveal = Math.max(1, Math.ceil(totalLetters * percentage))

  // Create reveal order for each token (from center outward)
  const tokenRevealOrders = tokens.map((token) => {
    const mid = Math.floor(token.length / 2)
    const order: number[] = []
    let left = mid - 1
    let right = mid

    while (order.length < token.length) {
      if (right < token.length) order.push(right++)
      if (left >= 0 && order.length < token.length) order.push(left--)
    }
    return order
  })

  // Round-robin reveal across tokens
  let revealed = 0
  const revealedIndices: Set<string>[] = tokens.map(() => new Set())
  let tokenIndex = 0
  const tokenPointers = tokens.map(() => 0)

  while (revealed < lettersToReveal) {
    const currentToken = tokens[tokenIndex]
    if (tokenPointers[tokenIndex] < currentToken.length) {
      const charIndex = tokenRevealOrders[tokenIndex][tokenPointers[tokenIndex]]
      revealedIndices[tokenIndex].add(charIndex.toString())
      tokenPointers[tokenIndex]++
      revealed++
    }
    tokenIndex = (tokenIndex + 1) % tokens.length

    // Check if all tokens are fully revealed
    if (tokenPointers.every((p, i) => p >= tokens[i].length)) break
  }

  // Build result string
  let result = ""
  tokens.forEach((token, tIdx) => {
    for (let i = 0; i < token.length; i++) {
      result += revealedIndices[tIdx].has(i.toString()) ? token[i] : "–"
    }
    if (tIdx < separatorMatches.length) {
      result += separatorMatches[tIdx]
    }
  })

  return result
}

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
                }
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
      setLoading(false);
    }
  }, [sessionId]);


  const getRevealedBrand = useCallback(() => {
    // Instant reveal if matched
    if (attempts.some(a => a.feedback.brandMatch)) return dailyPerfume.brand;

    const percentages = [0, 0, 0.1, 0.3, 0.6, 1.0]; // 0/0/10/30/60/100
    return revealLetters(dailyPerfume.brand, percentages[Math.min(revealLevel - 1, 5)])
  }, [revealLevel, dailyPerfume.brand, attempts])

  const getRevealedPerfumer = useCallback(() => {
    const perfumers = dailyPerfume.perfumer.split(',').map(p => p.trim());

    // Full reveal if all discovered OR game won (implicit by attempts check? no, need specific check)
    // Actually, if we want typical "Instant Reveal" on match, we handled singular discovery.
    // If the whole perfumer field matches, we reveal all.
    // Logic: If any attempt match is 'full', show all.
    if (attempts.some(a => a.feedback.perfumerMatch === "full")) return dailyPerfume.perfumer;

    // Check coverage
    if (perfumers.every(p => discoveredPerfumers.has(p))) return dailyPerfume.perfumer;

    return perfumers.map(p => {
      if (discoveredPerfumers.has(p)) return p;
      // Progressive fallback for undiscovered ones
      const percentages = [0, 0, 0.1, 0.3, 0.6, 1.0]; // 0/0/10/30/60/100
      return revealLetters(p, percentages[Math.min(revealLevel - 1, 5)]);
    }).join(', ');
  }, [revealLevel, dailyPerfume.perfumer, discoveredPerfumers, attempts])

  const getRevealedYear = useCallback(() => {
    // Instant reveal if matched
    if (attempts.some(a => a.feedback.yearMatch === "correct")) return dailyPerfume.year.toString();

    const year = dailyPerfume.year.toString()
    // Adjusted logic: conceal more initially?
    // Old: Level 1=XX––, Level 2=XXX–
    // New Percentages: 0/0/10/30... 
    // For year (4 chars), 10% is 0 chars. 30% is 1 char. 60% is 2 chars.
    // Let's map revealLevel to explicit masking for year since it's short.

    if (revealLevel >= 6) return year;
    if (revealLevel >= 5) return year.slice(0, 3) + "–"; // 60% -> 3 chars (75%)
    if (revealLevel >= 4) return year.slice(0, 2) + "––"; // 30% -> 2 chars (50%)
    if (revealLevel >= 3) return year.slice(0, 1) + "–––"; // 10% -> 1 char (25%)
    return "––––"; // 0%
  }, [revealLevel, dailyPerfume.year, attempts])

  // Removed getVisibleAccords

  const getVisibleNotes = useCallback(() => {
    // Level 1: only base, Level 2: base + heart, Level 3+: all
    return {
      top: revealLevel >= 3 ? dailyPerfume.notes.top : null,
      heart: revealLevel >= 2 ? dailyPerfume.notes.heart : null,
      base: revealLevel >= 1 ? dailyPerfume.notes.base : null,
    }
  }, [revealLevel, dailyPerfume.notes])

  const getBlurLevel = useCallback(() => {
    // 6 levels of blur: 32px -> 24px -> 16px -> 10px -> 4px -> 0px
    const blurLevels = [32, 24, 16, 10, 4, 0]
    return blurLevels[Math.min(revealLevel - 1, 5)]
  }, [revealLevel])

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
        resetGame: handleReset, // NEW
        xsolveScore: dailyPerfume.xsolve,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
