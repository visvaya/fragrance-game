import { render, screen, waitFor, act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameProvider, useGame } from '../game-provider'
import * as gameActions from '@/app/actions/game-actions'

// Mock dependencies
vi.mock('@/app/actions/game-actions', () => ({
    getDailyChallenge: vi.fn(),
    startGame: vi.fn(),
    submitGuess: vi.fn(),
    resetGame: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
            signInAnonymously: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null }),
        },
    })),
}))

vi.mock('posthog-js/react', () => ({
    usePostHog: vi.fn(() => ({
        capture: vi.fn(),
    })),
}))

// Helper component to expose context
function TestComponent() {
    const game = useGame()
    return (
        <div>
            <div data-testid="game-state">{game.gameState}</div>
            <div data-testid="attempts-count">{game.attempts.length}</div>
            <div data-testid="daily-brand">{game.dailyPerfume.brand}</div>
            <button onClick={() => game.makeGuess('Test Perfume', 'Test Brand', 'perfume-123')}>Guess</button>
        </div>
    )
}

describe('GameProvider', () => {
    const mockChallenge = {
        id: 'challenge-1',
        clues: {
            brand: 'Chanel',
            perfumer: 'Polge',
            year: 1921,
            gender: 'Female',
            notes: { top: ['A'], heart: ['B'], base: ['C'] },
            isLinear: false,
            xsolve: 100,
        },
    }

    const mockSession = {
        sessionId: 'session-1',
        nonce: 'nonce-1',
        imageUrl: '/test.jpg',
        guesses: [],
    }

    beforeEach(() => {
        vi.resetAllMocks()
        vi.mocked(gameActions.getDailyChallenge).mockResolvedValue(mockChallenge as any)
        vi.mocked(gameActions.startGame).mockResolvedValue(mockSession as any)
    })

    it('initializes game correctly', async () => {
        render(
            <GameProvider>
                <TestComponent />
            </GameProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('daily-brand')).toBe('Chanel')
        })

        expect(gameActions.getDailyChallenge).toHaveBeenCalled()
        expect(gameActions.startGame).toHaveBeenCalled()
    })

    it('handles making a correct guess', async () => {
        const mockGuessResult = {
            result: 'correct',
            newNonce: 'nonce-2',
            imageUrl: '/win.jpg',
            gameStatus: 'won',
            feedback: {
                brandMatch: true,
                perfumerMatch: 'full',
                yearMatch: 'correct',
                yearDirection: 'equal',
                notesMatch: 1,
            },
            guessedPerfumeDetails: { year: 1921, gender: 'Female' },
            guessedPerfumers: ['Polge'],
            answerName: 'N°5',
        }

        vi.mocked(gameActions.submitGuess).mockResolvedValue(mockGuessResult as any)

        render(
            <GameProvider>
                <TestComponent />
            </GameProvider>
        )

        // Wait for init
        await waitFor(() => expect(screen.getByTestId('daily-brand')).toBe('Chanel'))

        // Make guess
        await act(async () => {
            screen.getByText('Guess').click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('game-state')).toBe('won')
        })
    })

    it('handles making an incorrect guess', async () => {
        const mockGuessResult = {
            result: 'incorrect',
            newNonce: 'nonce-2',
            imageUrl: '/next.jpg',
            gameStatus: 'active',
            feedback: {
                brandMatch: false,
                perfumerMatch: 'none',
                yearMatch: 'wrong',
                yearDirection: 'higher',
                notesMatch: 0,
            },
            guessedPerfumeDetails: { year: 2000, gender: 'Male' },
        }

        vi.mocked(gameActions.submitGuess).mockResolvedValue(mockGuessResult as any)

        render(
            <GameProvider>
                <TestComponent />
            </GameProvider>
        )

        await waitFor(() => expect(screen.getByTestId('daily-brand')).toBe('Chanel'))

        await act(async () => {
            screen.getByText('Guess').click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('attempts-count')).toBe('1')
            expect(screen.getByTestId('game-state')).toBe('playing')
        })
    })
})
