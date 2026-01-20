"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { usePostHog } from 'posthog-js/react'
import { getDailyChallenge, startGame, submitGuess } from "@/app/actions/game-actions"
import { createClient } from "@/lib/supabase/client"

// Sample perfume data for demonstration (Fallback / Static part)
const DAILY_PERFUME = {
  id: 1,
  name: "Terre d'Hermès",
  brand: "Hermès",
  perfumer: "Jean-Claude Ellena",
  year: 2006,
  gender: "Masculine",
  notes: {
    top: ["Orange", "Grapefruit", "Bergamot"],
    heart: ["Pepper", "Geranium", "Patchouli"],
    base: ["Vetiver", "Cedar", "Benzoin"],
  },
  accords: ["Woody", "Earthy", "Citrus", "Aromatic", "Fresh Spicy"],
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
  dailyPerfume: typeof DAILY_PERFUME
  makeGuess: (perfumeName: string, brand: string, perfumeId: string) => void
  getRevealedBrand: () => string
  getRevealedPerfumer: () => string
  getRevealedYear: () => string
  getVisibleAccords: () => { visible: string[]; hidden: number }
  getVisibleNotes: () => { top: string[] | null; heart: string[] | null; base: string[] }
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

  const [nonce, setNonce] = useState<string>("") // Add nonce state

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
          const session = await startGame(challenge.id)
          setSessionId(session.sessionId)
          setNonce(session.nonce) // Store nonce
          if (session.imageUrl) {
            setImageUrl(session.imageUrl)
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
  const activePerfume = { ...DAILY_PERFUME, imageUrl }

  const currentAttempt = attempts.length + 1
  const maxAttempts = 5
  const revealLevel = Math.min(currentAttempt, maxAttempts)


  const makeGuess = useCallback(
    async (perfumeName: string, brand: string, perfumeId: string) => {
      if (gameState !== "playing" || attempts.length >= maxAttempts || !sessionId) return

      try {
        // BRIDGE IMPLEMENTATION:
        // Now using real perfumeId from Autocomplete
        const result = await submitGuess(sessionId, perfumeId, nonce)

        if (result.imageUrl) {
          setImageUrl(result.imageUrl)
        }

        if (result.newNonce) {
          setNonce(result.newNonce)
        }

        const feedback: AttemptFeedback = {
          brandMatch: brand.toLowerCase() === DAILY_PERFUME.brand.toLowerCase(),
          perfumerMatch: false,
          yearMatch: "wrong",
          notesMatch: "partial",
        }

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
    [attempts.length, gameState, maxAttempts, sessionId, nonce],
  )


  const getRevealedBrand = useCallback(() => {
    const percentages = [0.15, 0.3, 0.5, 0.75, 1.0]
    return revealLetters(DAILY_PERFUME.brand, percentages[revealLevel - 1])
  }, [revealLevel])

  const getRevealedPerfumer = useCallback(() => {
    const percentages = [0.1, 0.25, 0.45, 0.7, 1.0]
    return revealLetters(DAILY_PERFUME.perfumer, percentages[revealLevel - 1])
  }, [revealLevel])

  const getRevealedYear = useCallback(() => {
    const year = DAILY_PERFUME.year.toString()
    if (revealLevel === 1) return year.slice(0, 2) + "––"
    if (revealLevel === 2) return year.slice(0, 3) + "–"
    return year
  }, [revealLevel])

  const getVisibleAccords = useCallback(() => {
    const percentages = [0.25, 0.5, 0.75, 1.0, 1.0]
    const visibleCount = Math.ceil(DAILY_PERFUME.accords.length * percentages[revealLevel - 1])
    return {
      visible: DAILY_PERFUME.accords.slice(0, visibleCount),
      hidden: DAILY_PERFUME.accords.length - visibleCount,
    }
  }, [revealLevel])

  const getVisibleNotes = useCallback(() => {
    // Level 1: only base, Level 2: base + heart, Level 3+: all
    return {
      top: revealLevel >= 3 ? DAILY_PERFUME.notes.top : null,
      heart: revealLevel >= 2 ? DAILY_PERFUME.notes.heart : null,
      base: DAILY_PERFUME.notes.base,
    }
  }, [revealLevel])

  const getBlurLevel = useCallback(() => {
    // 5 levels of blur: 24px -> 18px -> 12px -> 6px -> 0px
    const blurLevels = [24, 18, 12, 6, 0]
    return blurLevels[revealLevel - 1]
  }, [revealLevel])

  const getPotentialScore = useCallback(() => {
    const baseScores = [1000, 700, 450, 250, 100]
    return baseScores[Math.min(currentAttempt - 1, 4)]
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
        getVisibleAccords,
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
