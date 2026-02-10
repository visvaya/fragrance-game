import {
  render,
  screen,
  waitFor,
  act,
  renderHook,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as gameActions from "@/app/actions/game-actions";

import { GameProvider, useGame } from "../game-provider";

// Mock dependencies
vi.mock("@/app/actions/game-actions", () => ({
  getDailyChallenge: vi.fn(),
  initializeGame: vi.fn(),
  resetGame: vi.fn(),
  startGame: vi.fn(),
  submitGuess: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
      }),
      signInAnonymously: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
        error: null,
      }),
    },
  })),
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: vi.fn(() => ({
    capture: vi.fn(),
  })),
}));

// Helper component to expose context
function TestComponent() {
  const game = useGame();
  return (
    <div>
      <div data-testid="game-state">{game.gameState}</div>
      <div data-testid="attempts-count">{game.attempts.length}</div>
      <div data-testid="daily-brand">{game.dailyPerfume.brand}</div>
      <button
        onClick={() =>
          game.makeGuess("Test Perfume", "Test Brand", "perfume-123")
        }
      >
        Guess
      </button>
    </div>
  );
}

describe("GameProvider", () => {
  const mockChallenge = {
    clues: {
      brand: "Chanel",
      gender: "Female",
      isLinear: false,
      notes: { base: ["C"], heart: ["B"], top: ["A"] },
      perfumer: "Polge",
      xsolve: 100,
      year: 1921,
    },
    id: "challenge-1",
  };

  const mockSession = {
    guesses: [],
    imageUrl: "/test.jpg",
    nonce: "nonce-1",
    sessionId: "session-1",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(gameActions.initializeGame).mockResolvedValue({
      challenge: mockChallenge as any,
      session: mockSession as any,
    });
  });

  it("initializes game correctly", async () => {
    render(
      <GameProvider>
        <TestComponent />
      </GameProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("daily-brand")).toHaveTextContent("Chanel");
    });

    expect(gameActions.initializeGame).toHaveBeenCalled();
  });

  it("handles making a correct guess", async () => {
    const mockGuessResult = {
      answerName: "N°5",
      feedback: {
        brandMatch: true,
        notesMatch: 1,
        perfumerMatch: "full",
        yearDirection: "equal",
        yearMatch: "correct",
      },
      gameStatus: "won",
      guessedPerfumeDetails: { gender: "Female", year: 1921 },
      guessedPerfumers: ["Polge"],
      imageUrl: "/win.jpg",
      newNonce: "nonce-2",
      result: "correct",
    };

    vi.mocked(gameActions.submitGuess).mockResolvedValue(
      mockGuessResult as any,
    );

    render(
      <GameProvider>
        <TestComponent />
      </GameProvider>,
    );

    // Wait for init
    await waitFor(() =>
      expect(screen.getByTestId("daily-brand")).toHaveTextContent("Chanel"),
    );

    // Make guess
    await act(async () => {
      screen.getByText("Guess").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("game-state")).toHaveTextContent("won");
    });
  });

  it("handles making an incorrect guess", async () => {
    const mockGuessResult = {
      feedback: {
        brandMatch: false,
        notesMatch: 0,
        perfumerMatch: "none",
        yearDirection: "higher",
        yearMatch: "wrong",
      },
      gameStatus: "active",
      guessedPerfumeDetails: { gender: "Male", year: 2000 },
      imageUrl: "/next.jpg",
      newNonce: "nonce-2",
      result: "incorrect",
    };

    vi.mocked(gameActions.submitGuess).mockResolvedValue(
      mockGuessResult as any,
    );

    render(
      <GameProvider>
        <TestComponent />
      </GameProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("daily-brand")).toHaveTextContent("Chanel"),
    );

    await act(async () => {
      screen.getByText("Guess").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("attempts-count")).toHaveTextContent("1");
      expect(screen.getByTestId("game-state")).toHaveTextContent("playing");
    });
  });
});
