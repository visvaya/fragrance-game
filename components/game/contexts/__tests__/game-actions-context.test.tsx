import type { ReactNode } from "react";

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { HIDDEN_CLUES, type RevealedClues } from "@/lib/game/clue-reveal";

import { GameActionsProvider, useGameActions } from "../game-actions-context";

import type { Attempt } from "../game-state-context";

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const {
  mockInitializeAndGuess,
  mockInitializeAndSkip,
  mockInitializeGame,
  mockResetGame,
  mockSkipAttempt,
  mockSubmitGuess,
} = vi.hoisted(() => ({
  mockInitializeAndGuess: vi.fn(),
  mockInitializeAndSkip: vi.fn(),
  mockInitializeGame: vi.fn(),
  mockResetGame: vi.fn(),
  mockSkipAttempt: vi.fn(),
  mockSubmitGuess: vi.fn(),
}));

const { mockHapticTrigger } = vi.hoisted(() => ({
  mockHapticTrigger: vi.fn().mockResolvedValue(undefined),
}));

const { mockToastError, mockToastWarning } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
}));

// Mock next-intl: GameActionsProvider calls useTranslations internally
function mockTranslator(key: string) {
  return key;
}
vi.mock("next-intl", () => ({
  useTranslations: () => mockTranslator,
}));

// Mock web-haptics/react
vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({ trigger: mockHapticTrigger }),
}));

// Mock sonner toasts
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    warning: mockToastWarning,
  },
}));

// Mock server actions
vi.mock("@/app/actions/game-actions", () => ({
  initializeAndGuess: mockInitializeAndGuess,
  initializeAndSkip: mockInitializeAndSkip,
  initializeGame: mockInitializeGame,
  resetGame: mockResetGame,
  skipAttempt: mockSkipAttempt,
  submitGuess: mockSubmitGuess,
}));

const MOCK_PERFUME = {
  concentration: "EDP",
  id: "test",
  imageUrl: "/test.jpg",
  name: "Mystery",
  xsolve: 0.5,
};

const LEVEL_2_CLUES: RevealedClues = {
  ...HIDDEN_CLUES,
  brand: "D__r",
  year: "1___",
};

const createWrapper = (
  overrides?: Partial<Parameters<typeof GameActionsProvider>[0]>,
) => {
  const defaultProps = {
    attempts: [],
    dailyPerfume: MOCK_PERFUME,
    gameState: "playing" as const,
    maxAttempts: 6,
    nonce: "test-nonce",
    sessionId: "test-session",
    setAttempts: vi.fn(),
    setClues: vi.fn(),
    setDailyPerfume: vi.fn(),
    setGameState: vi.fn(),
    setImageUrl: vi.fn(),
    setLoading: vi.fn(),
    setNonce: vi.fn(),
    setSessionId: vi.fn(),
    ...overrides,
  };

  return ({ children }: { children: ReactNode }) => (
    <GameActionsProvider {...defaultProps}>{children}</GameActionsProvider>
  );
};

describe("GameActionsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide game actions", () => {
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.makeGuess).toBeDefined();
    expect(result.current.resetGame).toBeDefined();
    expect(typeof result.current.makeGuess).toBe("function");
    expect(typeof result.current.resetGame).toBe("function");
  });

  it("should not allow guess when game is not playing", async () => {
    const setAttempts = vi.fn();
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        gameState: "won",
        setAttempts,
      }),
    });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(setAttempts).not.toHaveBeenCalled();
  });

  it("should not allow guess when no session", async () => {
    const setAttempts = vi.fn();
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        sessionId: null,
        setAttempts,
      }),
    });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(setAttempts).not.toHaveBeenCalled();
  });

  it("should not allow guess when max attempts reached", async () => {
    const mockAttempts: Attempt[] = Array.from<Attempt>({ length: 6 }).fill({
      brand: "Test",
      feedback: {
        brandMatch: false,
        genderMatch: false,
        notesMatch: 0,
        perfumerMatch: "none",
        yearDirection: "higher",
        yearMatch: "wrong",
      },
      guess: "Test",
    });
    const setAttempts = vi.fn();
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        attempts: mockAttempts,
        setAttempts,
      }),
    });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(setAttempts).not.toHaveBeenCalled();
  });

  it("should not allow reset when no session", async () => {
    const setLoading = vi.fn();
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        sessionId: null,
        setLoading,
      }),
    });

    await act(async () => {
      await result.current.resetGame();
    });

    expect(setLoading).not.toHaveBeenCalled();
  });

  it("should throw error when used outside provider", () => {
    expect(() => {
      renderHook(() => useGameActions());
    }).toThrow("useGameActions must be used within GameActionsProvider");
  });
});

// ---------------------------------------------------------------------------
// makeGuess — action execution paths (authReady: true required)
// ---------------------------------------------------------------------------

const VALID_PERFUME_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d471";

const SUCCESS_GUESS_RESULT = {
  answerConcentration: undefined,
  answerName: undefined,
  feedback: {
    brandMatch: false,
    genderMatch: false,
    notesMatch: 0,
    perfumerMatch: "none" as const,
    yearDirection: "higher" as const,
    yearMatch: "wrong" as const,
  },
  gameStatus: "playing" as const,
  guessedPerfumeDetails: { concentration: "EDP", gender: "Male", year: 2015 },
  guessedPerfumers: ["Creator"],
  hasGuessedNotes: false,
  imageUrl: null,
  newNonce: "nonce-2",
  result: "wrong" as const,
  revealed: LEVEL_2_CLUES,
};

function createAuthWrapper(
  overrides?: Partial<Parameters<typeof GameActionsProvider>[0]>,
) {
  return createWrapper({ authReady: true, ...overrides });
}

describe("makeGuess — successful paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls submitGuess and appends attempt on success (playing continues)", async () => {
    mockSubmitGuess.mockResolvedValueOnce(SUCCESS_GUESS_RESULT);
    const setAttempts = vi.fn();
    const setLoading = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setAttempts, setLoading }),
    });

    await act(async () => {
      await result.current.makeGuess("Sauvage", "Dior", VALID_PERFUME_ID);
    });

    expect(mockSubmitGuess).toHaveBeenCalledWith(
      "test-session",
      VALID_PERFUME_ID,
      "test-nonce",
    );
    expect(setAttempts).toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("stores the server clues and feedback from the guess result", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      feedback: { ...SUCCESS_GUESS_RESULT.feedback, genderMatch: true },
    });
    const setAttempts = vi.fn();
    const setClues = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setAttempts, setClues }),
    });

    await act(async () => {
      await result.current.makeGuess("Sauvage", "Dior", VALID_PERFUME_ID);
    });

    expect(setClues).toHaveBeenCalledWith(LEVEL_2_CLUES);
    const update = setAttempts.mock.calls[0]?.[0] as (
      previous: Attempt[],
    ) => Attempt[];
    const [added] = update([]);
    expect(added.feedback.genderMatch).toBe(true);
    expect(added).not.toHaveProperty("snapshot");
  });

  it("sets gameState to 'won' when result is 'won'", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      answerName: "Sauvage",
      feedback: {
        ...SUCCESS_GUESS_RESULT.feedback,
        brandMatch: true,
        yearMatch: "correct",
      },
      gameStatus: "won" as const,
      imageUrl: "/win.jpg",
      result: "correct" as const,
    });
    const setGameState = vi.fn();
    const setAttempts = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setAttempts, setGameState }),
    });

    await act(async () => {
      await result.current.makeGuess("Sauvage", "Dior", VALID_PERFUME_ID);
    });

    expect(setGameState).toHaveBeenCalledWith("won");
  });

  it("sets gameState to 'lost' when gameStatus is 'lost'", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      answerName: "Sauvage",
      gameStatus: "lost" as const,
    });
    const setGameState = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setGameState }),
    });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(setGameState).toHaveBeenCalledWith("lost");
  });

  it("updates nonce from newNonce", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      newNonce: "nonce-updated",
    });
    const setNonce = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setNonce }),
    });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(setNonce).toHaveBeenCalledWith("nonce-updated");
  });

  it("updates imageUrl when result contains one", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      imageUrl: "/step2.jpg",
    });
    const setImageUrl = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setImageUrl }),
    });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(setImageUrl).toHaveBeenCalledWith("/step2.jpg");
  });

  it("uses lazy init path (initializeAndGuess) when sessionId is null", async () => {
    mockInitializeAndGuess.mockResolvedValueOnce({
      guessResult: SUCCESS_GUESS_RESULT,
      imageUrl: "/lazy.jpg",
      nonce: "lazy-nonce",
      sessionId: "new-session-id",
    });
    const setSessionId = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({
        challengeId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: null,
        setSessionId,
      }),
    });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(mockInitializeAndGuess).toHaveBeenCalled();
    expect(mockSubmitGuess).not.toHaveBeenCalled();
    expect(setSessionId).toHaveBeenCalledWith("new-session-id");
  });
});

describe("makeGuess — error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows rate limit toast when error starts with 'Rate limit exceeded'", async () => {
    mockSubmitGuess.mockRejectedValueOnce(
      new Error("Rate limit exceeded — slow down"),
    );
    const setLoading = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setLoading }),
    });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(mockToastWarning).toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("shows network error toast on generic error", async () => {
    mockSubmitGuess.mockRejectedValueOnce(new Error("Network error"));
    const setLoading = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setLoading }),
    });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(mockToastError).toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("blocks concurrent guess while processing", async () => {
    let resolveFirst!: () => void;
    const firstCall = new Promise<typeof SUCCESS_GUESS_RESULT>((resolve) => {
      resolveFirst = () => resolve(SUCCESS_GUESS_RESULT);
    });
    mockSubmitGuess.mockReturnValueOnce(firstCall);

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper(),
    });

    // Start first guess (doesn't await)
    const p1 = result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    // Immediately try a second guess
    const p2 = result.current.makeGuess("Y", "Chanel", VALID_PERFUME_ID);

    resolveFirst();
    await act(async () => {
      await Promise.all([p1, p2]);
    });

    // submitGuess should only be called once (second call was blocked)
    expect(mockSubmitGuess).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// skipAttempt — action execution paths
// ---------------------------------------------------------------------------

const SKIP_RESULT = {
  answerConcentration: undefined,
  answerName: undefined,
  gameStatus: "playing" as const,
  imageUrl: null,
  newNonce: "skip-nonce",
  revealed: LEVEL_2_CLUES,
};

describe("skipAttempt — successful paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls skipAttempt and appends skipped attempt", async () => {
    mockSkipAttempt.mockResolvedValueOnce(SKIP_RESULT);
    const setAttempts = vi.fn();
    const setLoading = vi.fn();
    const setClues = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setAttempts, setClues, setLoading }),
    });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockSkipAttempt).toHaveBeenCalledWith("test-session", "test-nonce");
    expect(setAttempts).toHaveBeenCalled();
    expect(setClues).toHaveBeenCalledWith(LEVEL_2_CLUES);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("sets gameState to 'lost' when skip returns gameStatus 'lost'", async () => {
    mockSkipAttempt.mockResolvedValueOnce({
      ...SKIP_RESULT,
      answerName: "Sauvage",
      gameStatus: "lost" as const,
    });
    const setGameState = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setGameState }),
    });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(setGameState).toHaveBeenCalledWith("lost");
  });

  it("does not skip when authReady=false", async () => {
    const setAttempts = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({ setAttempts }),
    });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockSkipAttempt).not.toHaveBeenCalled();
    expect(setAttempts).not.toHaveBeenCalled();
  });

  it("shows rate limit toast on rate limit error during skip", async () => {
    mockSkipAttempt.mockRejectedValueOnce(
      new Error("Rate limit exceeded — slow down"),
    );

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper(),
    });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockToastWarning).toHaveBeenCalled();
  });

  it("uses lazy init path (initializeAndSkip) when sessionId is null", async () => {
    mockInitializeAndSkip.mockResolvedValueOnce({
      imageUrl: null,
      nonce: "skip-lazy-nonce",
      sessionId: "new-session",
      skipResult: SKIP_RESULT,
    });
    const setSessionId = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({
        challengeId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: null,
        setSessionId,
      }),
    });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockInitializeAndSkip).toHaveBeenCalled();
    expect(mockSkipAttempt).not.toHaveBeenCalled();
    expect(setSessionId).toHaveBeenCalledWith("new-session");
  });
});

// ---------------------------------------------------------------------------
// resetGame — action execution paths
// ---------------------------------------------------------------------------

describe("resetGame — successful paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls resetGame server action and resets state", async () => {
    mockResetGame.mockResolvedValueOnce({ success: true });
    mockInitializeGame.mockResolvedValueOnce({
      challenge: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        revealed: HIDDEN_CLUES,
        xsolve: 90,
      },
      session: {
        imageUrl: "/fresh.jpg",
        nonce: "fresh-nonce",
        revealed: LEVEL_2_CLUES,
        sessionId: "fresh-session",
      },
    });

    const setAttempts = vi.fn();
    const setGameState = vi.fn();
    const setLoading = vi.fn();
    const setClues = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({
        setAttempts,
        setClues,
        setGameState,
        setLoading,
      }),
    });

    await act(async () => {
      await result.current.resetGame();
    });

    expect(mockResetGame).toHaveBeenCalledWith("test-session");
    expect(setAttempts).toHaveBeenCalledWith([]);
    expect(setGameState).toHaveBeenCalledWith("playing");
    expect(setClues).toHaveBeenCalledWith(HIDDEN_CLUES);
    expect(setClues).toHaveBeenLastCalledWith(LEVEL_2_CLUES);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("handles reset server error gracefully", async () => {
    mockResetGame.mockRejectedValueOnce(new Error("Server error"));
    const setLoading = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({ setLoading }),
    });

    await act(async () => {
      await result.current.resetGame();
    });

    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("handles reset when backend returns success:false", async () => {
    mockResetGame.mockResolvedValueOnce({ success: false });
    const setAttempts = vi.fn();
    const setLoading = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper({ setAttempts, setLoading }),
    });

    await act(async () => {
      await result.current.resetGame();
    });

    // State should NOT be reset when backend reports failure
    expect(setAttempts).not.toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledWith(false);
  });
});

describe("skipAttempt — network error path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows network error toast on generic skip error", async () => {
    mockSkipAttempt.mockRejectedValueOnce(new Error("Connection refused"));
    const setLoading = vi.fn();

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper({ setLoading }),
    });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockToastError).toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledWith(false);
  });
});
