import {
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as gameActions from "@/app/actions/game-actions";

import { UIPreferencesProvider } from "../contexts/ui-preferences-context";
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

const messages = {
  Auth: {
    register: {
      title: "Register",
    },
  },
};

const VALID_SESSION_ID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";

// Helper component to expose context
function TestComponent() {
  const game = useGame();
  return (
    <div>
      <div data-testid="game-state">{game.gameState}</div>
      <div data-testid="attempts-count">{game.attempts.length}</div>
      <div data-testid="daily-brand">{game.dailyPerfume.brand}</div>
      <button
        onClick={async () =>
          game.makeGuess("Test Perfume", "Test Brand", "f47ac10b-58cc-4372-a567-0e02b2c3d479")
        }
      >
        Guess
      </button>
    </div>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UIPreferencesProvider>
        {ui}
      </UIPreferencesProvider>
    </NextIntlClientProvider>
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
    id: VALID_CHALLENGE_ID,
  };

  const mockSession = {
    guesses: [],
    imageUrl: "/test.jpg",
    nonce: "nonce-1",
    sessionId: VALID_SESSION_ID,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(gameActions.initializeGame).mockResolvedValue({
      challenge: mockChallenge as any,
      session: mockSession as any,
    });
  });

  it("initializes game correctly", async () => {
    renderWithProviders(
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

    renderWithProviders(
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

    renderWithProviders(
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
