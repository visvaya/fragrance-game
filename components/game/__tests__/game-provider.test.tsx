import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as gameActions from "@/app/actions/game-actions";
import * as getClientModule from "@/lib/supabase/get-client";

import { UIPreferencesProvider } from "../contexts/ui-preferences-context";
import { GameProvider, useGame } from "../game-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/routing", () => ({
  Link: function MockLink({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  },
  localeNames: { en: "English", pl: "Polski" },
  routing: { defaultLocale: "pl", locales: ["en", "pl"] },
  usePathname: () => "/en",
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock dependencies
vi.mock("@/app/actions/game-actions", () => ({
  getDailyChallenge: vi.fn(),
  getDailyChallengeSSR: vi.fn(),
  initializeGame: vi.fn(),
  resetGame: vi.fn(),
  startGame: vi.fn(),
  submitGuess: vi.fn(),
}));

vi.mock("@/lib/supabase/get-client", () => ({
  getSupabaseClient: vi.fn(),
}));

const messages = {
  Auth: {
    register: {
      captchaDescription: "Please verify you are human.",
      captchaTitle: "Verification Required",
      title: "Register",
    },
  },
  Migration: {
    abortHelp: "Close to abort.",
    cancel: "Skip",
    cancelConfirm: "Are you sure?",
    confirm: "Yes, Merge",
    description: "Migrate your progress?",
    error: "Failed.",
    exitConfirm: "Abort?",
    success: "Merged!",
    title: "Anonymous Session Detected",
    warning: "Skipping will abandon anonymous results.",
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
          game.makeGuess(
            "Test Perfume",
            "Test Brand",
            "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          )
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
      <UIPreferencesProvider>{ui}</UIPreferencesProvider>
    </NextIntlClientProvider>,
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
    const mockSupabaseClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "test-user" } } },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInAnonymously: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "test-user" } } },
          error: null,
        }),
      },
    };
    vi.mocked(getClientModule.getSupabaseClient).mockResolvedValue(
      mockSupabaseClient as any,
    );
    vi.mocked(gameActions.initializeGame).mockResolvedValue({
      challenge: mockChallenge as any,
      session: mockSession as any,
    });
    vi.mocked(gameActions.startGame).mockResolvedValue(mockSession as any);
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

    // eslint-disable-next-line testing-library/prefer-user-event -- direct fireEvent used for low-level mock interaction; userEvent overhead unnecessary here
    fireEvent.click(screen.getByText("Guess"));

    await waitFor(() => {
      expect(screen.getByTestId("game-state")).toHaveTextContent("won");
    });
  });

  it("uses initialChallenge prop to skip getDailyChallenge roundtrip", async () => {
    const mockInitialChallenge = {
      challenge_date: "2026-02-27",
      clues: {
        brand: "Chanel",
        concentration: "EDP",
        gender: "Feminine",
        isLinear: false,
        notes: { base: ["Vanilla"], heart: ["Rose"], top: ["Bergamot"] },
        perfumer: "Jacques Polge",
        xsolve: 3,
        year: 1921,
      },
      grace_deadline_at_utc: "2026-02-28T00:00:00Z",
      id: VALID_CHALLENGE_ID,
      mode: "standard",
      snapshot_metadata: {},
    };

    renderWithProviders(
      <GameProvider initialChallenge={mockInitialChallenge as any}>
        <TestComponent />
      </GameProvider>,
    );

    await waitFor(() => {
      // Gate 6: neither initializeGame nor startGame called when initialChallenge is provided.
      // startGame is deferred to the first user action (lazy init).
      expect(gameActions.initializeGame).not.toHaveBeenCalled();
      expect(gameActions.startGame).not.toHaveBeenCalled();
    });

    expect(screen.getByTestId("daily-brand")).toHaveTextContent("Chanel");
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

    // eslint-disable-next-line testing-library/prefer-user-event -- direct fireEvent used for low-level mock interaction; userEvent overhead unnecessary here
    fireEvent.click(screen.getByText("Guess"));

    await waitFor(() => {
      expect(screen.getByTestId("attempts-count")).toHaveTextContent("1");
      expect(screen.getByTestId("game-state")).toHaveTextContent("playing");
    });
  });
});
