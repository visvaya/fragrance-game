import { useReducer, type ReactNode } from "react";

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { HIDDEN_CLUES, type RevealedClues } from "@/lib/game/clue-reveal";
import {
  SKIPPED_ATTEMPT,
  gameSessionReducer,
  type Attempt,
  type GameSessionState,
} from "@/lib/game/game-session-state";

import { GameActionsProvider, useGameActions } from "../game-actions-context";

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

const BASE_STATE: GameSessionState = {
  attempts: [],
  clues: HIDDEN_CLUES,
  dailyPerfume: MOCK_PERFUME,
  gameState: "playing",
  imageUrl: "/test.jpg",
  nonce: "test-nonce",
  sessionId: "test-session",
  sessionReady: true,
};

type WrapperOptions = {
  authReady?: boolean;
  challengeId?: string;
  state?: Partial<GameSessionState>;
};

/**
 * Renders the provider over the real game session reducer: `probe.state` is the state after
 * the dispatched changes, `probe.dispatch` records them.
 */
const createWrapper = ({
  authReady,
  challengeId,
  state,
}: WrapperOptions = {}) => {
  const probe = {
    dispatch: vi.fn(),
    setLoading: vi.fn(),
    state: { ...BASE_STATE, ...state },
  };

  function Wrapper({ children }: { children: ReactNode }) {
    const [current, reduce] = useReducer(gameSessionReducer, probe.state);
    probe.state = current;
    probe.dispatch.mockImplementation(reduce);
    return (
      <GameActionsProvider
        attempts={current.attempts}
        dispatch={probe.dispatch}
        gameState={current.gameState}
        maxAttempts={6}
        nonce={current.nonce}
        sessionId={current.sessionId}
        setLoading={probe.setLoading}
        {...(authReady === undefined ? {} : { authReady })}
        {...(challengeId === undefined ? {} : { challengeId })}
      >
        {children}
      </GameActionsProvider>
    );
  }

  return { probe, wrapper: Wrapper };
};

describe("GameActionsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide game actions", () => {
    const { result } = renderHook(() => useGameActions(), {
      wrapper: createWrapper().wrapper,
    });

    expect(result.current.makeGuess).toBeDefined();
    expect(result.current.resetGame).toBeDefined();
    expect(typeof result.current.makeGuess).toBe("function");
    expect(typeof result.current.resetGame).toBe("function");
  });

  it("should not allow guess when game is not playing", async () => {
    const { probe, wrapper } = createWrapper({ state: { gameState: "won" } });
    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(probe.dispatch).not.toHaveBeenCalled();
  });

  it("should not allow guess when no session", async () => {
    const { probe, wrapper } = createWrapper({ state: { sessionId: null } });
    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(probe.dispatch).not.toHaveBeenCalled();
  });

  it("should not allow guess when max attempts reached", async () => {
    const mockAttempts: Attempt[] = Array.from({ length: 6 }, () => ({
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
    }));
    const { probe, wrapper } = createWrapper({
      state: { attempts: mockAttempts },
    });
    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("Test Perfume", "Test Brand", "test-id");
    });

    expect(probe.dispatch).not.toHaveBeenCalled();
  });

  it("should not allow reset when no session", async () => {
    const { probe, wrapper } = createWrapper({ state: { sessionId: null } });
    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.resetGame();
    });

    expect(probe.setLoading).not.toHaveBeenCalled();
  });

  it("should throw error when used outside provider", () => {
    expect(() => {
      renderHook(() => useGameActions());
    }).toThrow("useGameActions must be used within GameActionsProvider");
  });
});

// ---------------------------------------------------------------------------
// makeGuess – action execution paths (authReady: true required)
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

function createAuthWrapper(options?: WrapperOptions) {
  return createWrapper({ authReady: true, ...options });
}

describe("makeGuess – successful paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls submitGuess and appends attempt on success (playing continues)", async () => {
    mockSubmitGuess.mockResolvedValueOnce(SUCCESS_GUESS_RESULT);
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("Sauvage", "Dior", VALID_PERFUME_ID);
    });

    expect(mockSubmitGuess).toHaveBeenCalledWith(
      "test-session",
      VALID_PERFUME_ID,
      "test-nonce",
    );
    expect(probe.state.attempts).toHaveLength(1);
    expect(probe.state.gameState).toBe("playing");
    expect(probe.setLoading).toHaveBeenCalledWith(true);
    expect(probe.setLoading).toHaveBeenCalledWith(false);
  });

  it("stores the server clues and feedback from the guess result", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      feedback: { ...SUCCESS_GUESS_RESULT.feedback, genderMatch: true },
    });
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("Sauvage", "Dior", VALID_PERFUME_ID);
    });

    expect(probe.state.clues).toEqual(LEVEL_2_CLUES);
    const [added] = probe.state.attempts;
    expect(added).toBeDefined();
    expect(added?.feedback.genderMatch).toBe(true);
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
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("Sauvage", "Dior", VALID_PERFUME_ID);
    });

    expect(probe.state.gameState).toBe("won");
  });

  it("sets gameState to 'lost' when gameStatus is 'lost'", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      answerName: "Sauvage",
      gameStatus: "lost" as const,
    });
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(probe.state.gameState).toBe("lost");
  });

  it("updates nonce from newNonce", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      newNonce: "nonce-updated",
    });
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(probe.state.nonce).toBe("nonce-updated");
  });

  it("updates imageUrl when result contains one", async () => {
    mockSubmitGuess.mockResolvedValueOnce({
      ...SUCCESS_GUESS_RESULT,
      imageUrl: "/step2.jpg",
    });
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(probe.state.imageUrl).toBe("/step2.jpg");
  });

  it("uses lazy init path (initializeAndGuess) when sessionId is null", async () => {
    mockInitializeAndGuess.mockResolvedValueOnce({
      guessResult: { ...SUCCESS_GUESS_RESULT, newNonce: "" },
      imageUrl: "/lazy.jpg",
      nonce: "lazy-nonce",
      sessionId: "new-session-id",
    });
    const { probe, wrapper } = createAuthWrapper({
      challengeId: "550e8400-e29b-41d4-a716-446655440000",
      state: { nonce: "", sessionId: null, sessionReady: false },
    });

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(mockInitializeAndGuess).toHaveBeenCalled();
    expect(mockSubmitGuess).not.toHaveBeenCalled();
    expect(probe.state).toMatchObject({
      imageUrl: "/lazy.jpg",
      nonce: "lazy-nonce",
      sessionId: "new-session-id",
      sessionReady: true,
    });
    expect(probe.state.attempts).toHaveLength(1);
  });
});

describe("makeGuess – error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows rate limit toast when error starts with 'Rate limit exceeded'", async () => {
    mockSubmitGuess.mockRejectedValueOnce(
      new Error("Rate limit exceeded – slow down"),
    );
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(mockToastWarning).toHaveBeenCalled();
    expect(probe.setLoading).toHaveBeenCalledWith(false);
  });

  it("keeps the rate limit lock for 60 s after the last rate limit error", async () => {
    vi.useFakeTimers();
    try {
      mockSubmitGuess
        .mockRejectedValueOnce(new Error("Rate limit exceeded – slow down"))
        .mockRejectedValueOnce(new Error("Rate limit exceeded – slow down"));
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useGameActions(), { wrapper });

      await act(async () => {
        await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
      });
      await act(async () => {
        vi.advanceTimersByTime(30_000);
        await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
      });
      act(() => {
        vi.advanceTimersByTime(59_000);
      });
      expect(result.current.isRateLimited).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.isRateLimited).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows network error toast on generic error", async () => {
    mockSubmitGuess.mockRejectedValueOnce(new Error("Network error"));
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.makeGuess("X", "Dior", VALID_PERFUME_ID);
    });

    expect(mockToastError).toHaveBeenCalled();
    expect(probe.setLoading).toHaveBeenCalledWith(false);
  });

  it("blocks concurrent guess while processing", async () => {
    let resolveFirst!: () => void;
    const firstCall = new Promise<typeof SUCCESS_GUESS_RESULT>((resolve) => {
      resolveFirst = () => resolve(SUCCESS_GUESS_RESULT);
    });
    mockSubmitGuess.mockReturnValueOnce(firstCall);

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper().wrapper,
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
// skipAttempt – action execution paths
// ---------------------------------------------------------------------------

const SKIP_RESULT = {
  answerConcentration: undefined,
  answerName: undefined,
  gameStatus: "playing" as const,
  imageUrl: null,
  newNonce: "skip-nonce",
  revealed: LEVEL_2_CLUES,
};

describe("skipAttempt – successful paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls skipAttempt and appends skipped attempt", async () => {
    mockSkipAttempt.mockResolvedValueOnce(SKIP_RESULT);
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockSkipAttempt).toHaveBeenCalledWith("test-session", "test-nonce");
    expect(probe.state.attempts).toHaveLength(1);
    expect(probe.state.attempts[0]).toMatchObject({ isSkipped: true });
    expect(probe.state.clues).toEqual(LEVEL_2_CLUES);
    expect(probe.state.nonce).toBe("skip-nonce");
    expect(probe.setLoading).toHaveBeenCalledWith(false);
  });

  it("sets gameState to 'lost' when skip returns gameStatus 'lost'", async () => {
    mockSkipAttempt.mockResolvedValueOnce({
      ...SKIP_RESULT,
      answerName: "Sauvage",
      gameStatus: "lost" as const,
    });
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(probe.state.gameState).toBe("lost");
  });

  it("does not skip when authReady=false", async () => {
    const { probe, wrapper } = createWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockSkipAttempt).not.toHaveBeenCalled();
    expect(probe.dispatch).not.toHaveBeenCalled();
  });

  it("shows rate limit toast on rate limit error during skip", async () => {
    mockSkipAttempt.mockRejectedValueOnce(
      new Error("Rate limit exceeded – slow down"),
    );

    const { result } = renderHook(() => useGameActions(), {
      wrapper: createAuthWrapper().wrapper,
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
    const { probe, wrapper } = createAuthWrapper({
      challengeId: "550e8400-e29b-41d4-a716-446655440000",
      state: { nonce: "", sessionId: null, sessionReady: false },
    });

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockInitializeAndSkip).toHaveBeenCalled();
    expect(mockSkipAttempt).not.toHaveBeenCalled();
    expect(probe.state).toMatchObject({
      nonce: "skip-lazy-nonce",
      sessionId: "new-session",
      sessionReady: true,
    });
    expect(probe.state.attempts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// resetGame – action execution paths
// ---------------------------------------------------------------------------

describe("resetGame – successful paths", () => {
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

    const { probe, wrapper } = createWrapper({
      state: { attempts: [SKIPPED_ATTEMPT], gameState: "lost" },
    });

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.resetGame();
    });

    expect(mockResetGame).toHaveBeenCalledWith("test-session");
    expect(probe.dispatch).toHaveBeenNthCalledWith(1, { type: "resetCleared" });
    expect(probe.state).toMatchObject({
      attempts: [],
      clues: LEVEL_2_CLUES,
      gameState: "playing",
      imageUrl: "/fresh.jpg?reset=fresh-session",
      nonce: "fresh-nonce",
      sessionId: "fresh-session",
    });
    expect(probe.setLoading).toHaveBeenCalledWith(false);
  });

  it("handles reset server error gracefully", async () => {
    mockResetGame.mockRejectedValueOnce(new Error("Server error"));
    const { probe, wrapper } = createWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.resetGame();
    });

    expect(probe.setLoading).toHaveBeenCalledWith(false);
  });

  it("handles reset when backend returns success:false", async () => {
    mockResetGame.mockResolvedValueOnce({ success: false });
    const { probe, wrapper } = createWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.resetGame();
    });

    // State should NOT be reset when backend reports failure
    expect(probe.dispatch).not.toHaveBeenCalled();
    expect(probe.setLoading).toHaveBeenCalledWith(false);
  });
});

describe("skipAttempt – network error path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows network error toast on generic skip error", async () => {
    mockSkipAttempt.mockRejectedValueOnce(new Error("Connection refused"));
    const { probe, wrapper } = createAuthWrapper();

    const { result } = renderHook(() => useGameActions(), { wrapper });

    await act(async () => {
      await result.current.skipAttempt();
    });

    expect(mockToastError).toHaveBeenCalled();
    expect(probe.setLoading).toHaveBeenCalledWith(false);
  });
});
