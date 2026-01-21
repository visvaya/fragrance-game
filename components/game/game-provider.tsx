"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { usePostHog } from 'posthog-js/react'
import { getDailyChallenge, startGame, submitGuess, type DailyChallenge } from "@/app/actions/game-actions"
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
  // Accords removed
  imageUrl: "/placeholder.svg?height=400&width=400",
}

export type AttemptFeedback = {
  brandMatch: boolean
  perfumerMatch: boolean
  yearMatch: "correct" | "close" | "wrong"
  notesMatch: "full" | "partial" | "none"
}

export type Attempt = {
  guess: string
  brand: string
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
  sessionId: string | null // Exposed for Autocomplete context
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
                  perfumerMatch: isCorrect, // approximated
                  yearMatch: isCorrect ? "correct" : "wrong", // approximated
                  notesMatch: isCorrect ? "full" : "partial" // approximated
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


  const getRevealedBrand = useCallback(() => {
    const percentages = [0.15, 0.3, 0.5, 0.75, 1.0, 1.0] // Adjusted for 6 attempts
    return revealLetters(dailyPerfume.brand, percentages[Math.min(revealLevel - 1, 5)])
  }, [revealLevel, dailyPerfume.brand])

  const getRevealedPerfumer = useCallback(() => {
    const percentages = [0.1, 0.25, 0.45, 0.7, 1.0, 1.0] // Adjusted for 6 attempts
    return revealLetters(dailyPerfume.perfumer, percentages[Math.min(revealLevel - 1, 5)])
  }, [revealLevel, dailyPerfume.perfumer])

  const getRevealedYear = useCallback(() => {
    const year = dailyPerfume.year.toString()
    if (revealLevel === 1) return year.slice(0, 2) + "––"
    if (revealLevel === 2) return year.slice(0, 3) + "–"
    return year
  }, [revealLevel, dailyPerfume.year])

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
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
