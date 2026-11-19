import { describe, expect, it } from "vitest";

import { HIDDEN_CLUES, type RevealedClues } from "@/lib/game/clue-reveal";
import {
  SKELETON_PERFUME,
  SKIPPED_ATTEMPT,
  gameSessionReducer,
  initialGameSessionState,
  type GameSessionState,
} from "@/lib/game/game-session-state";
import { getRevealPercentages } from "@/lib/game/scoring";

import type {
  DailyChallenge,
  SkipAttemptResult,
  StartGameResponse,
  SubmitGuessResult,
} from "@/app/actions/game-actions";
import type { AttemptFeedback } from "@/lib/game/guess-feedback";
import type { GuessHistoryItem } from "@/lib/game/guess-history";

const MAX_ATTEMPTS = 6;

const FEEDBACK: AttemptFeedback = {
  brandMatch: true,
  genderMatch: false,
  notesMatch: 1,
  perfumerMatch: "none",
  yearDirection: "higher",
  yearMatch: "wrong",
};

const REVEAL_STATE = getRevealPercentages(1);

const CHALLENGE_CLUES: RevealedClues = { ...HIDDEN_CLUES, brand: "C____l" };
const SESSION_CLUES: RevealedClues = { ...HIDDEN_CLUES, brand: "Ch___l" };
const NEXT_CLUES: RevealedClues = { ...HIDDEN_CLUES, brand: "Cha__l" };

const CHALLENGE: Pick<DailyChallenge, "revealed" | "xsolve"> = {
  revealed: CHALLENGE_CLUES,
  xsolve: 3,
};

function guessItem(
  overrides: Partial<GuessHistoryItem> = {},
): GuessHistoryItem {
  return {
    brandName: "Chanel",
    concentration: "EDP",
    feedback: FEEDBACK,
    gender: "Female",
    isCorrect: false,
    perfumeId: "perfume-1",
    perfumeName: "N5",
    perfumers: ["Polge"],
    timestamp: "2026-11-19T10:00:00Z",
    year: 1921,
    ...overrides,
  };
}

function session(
  overrides: Partial<StartGameResponse> = {},
): StartGameResponse {
  return {
    graceDeadline: "2026-11-20T00:00:00Z",
    guesses: [],
    imageUrl: "/session.jpg",
    nonce: "nonce-1",
    revealed: SESSION_CLUES,
    revealState: REVEAL_STATE,
    sessionId: "session-1",
    ...overrides,
  };
}

function guessResult(
  overrides: Partial<SubmitGuessResult> = {},
): SubmitGuessResult {
  return {
    feedback: FEEDBACK,
    gameStatus: "active",
    guessedPerfumeDetails: { concentration: "EDT", gender: "Male", year: 2015 },
    guessedPerfumers: ["Creator"],
    hasGuessedNotes: true,
    imageUrl: null,
    newNonce: "nonce-2",
    result: "incorrect",
    revealed: NEXT_CLUES,
    revealState: REVEAL_STATE,
    ...overrides,
  };
}

function skipResult(
  overrides: Partial<SkipAttemptResult> = {},
): SkipAttemptResult {
  return {
    gameStatus: "active",
    imageUrl: null,
    newNonce: "nonce-2",
    revealed: NEXT_CLUES,
    ...overrides,
  };
}

const GUESS = { brand: "Dior", perfumeId: "perfume-9", perfumeName: "Sauvage" };

function playing(overrides: Partial<GameSessionState> = {}): GameSessionState {
  return {
    ...initialGameSessionState({
      initialChallenge: CHALLENGE,
      initialSession: session(),
      maxAttempts: MAX_ATTEMPTS,
    }),
    ...overrides,
  };
}

describe("initialGameSessionState", () => {
  it("is empty and not ready without a challenge and a session", () => {
    expect(initialGameSessionState({ maxAttempts: MAX_ATTEMPTS })).toEqual({
      attempts: [],
      clues: HIDDEN_CLUES,
      dailyPerfume: SKELETON_PERFUME,
      gameState: "playing",
      imageUrl: "/placeholder.svg?height=400&width=400",
      nonce: "",
      sessionId: null,
      sessionReady: false,
    });
  });

  it("uses the SSR challenge without a session: its clues, not ready", () => {
    expect(
      initialGameSessionState({
        initialChallenge: CHALLENGE,
        initialImageUrl: "/ssr.jpg",
        initialSession: null,
        maxAttempts: MAX_ATTEMPTS,
      }),
    ).toEqual({
      attempts: [],
      clues: CHALLENGE_CLUES,
      dailyPerfume: {
        concentration: undefined,
        id: "daily",
        imageUrl: "/ssr.jpg",
        name: "Mystery Perfume",
        xsolve: 3,
      },
      gameState: "playing",
      imageUrl: "/ssr.jpg",
      nonce: "",
      sessionId: null,
      sessionReady: false,
    });
  });

  it("restores a session in progress", () => {
    const state = initialGameSessionState({
      initialChallenge: CHALLENGE,
      initialSession: session({
        guesses: [guessItem(), guessItem({ isSkip: true })],
      }),
      maxAttempts: MAX_ATTEMPTS,
    });

    expect(state.attempts).toHaveLength(2);
    expect(state.attempts[0]).toMatchObject({ brand: "Chanel", guess: "N5" });
    expect(state.attempts[1]).toMatchObject({ guess: "", isSkipped: true });
    expect(state).toMatchObject({
      clues: SESSION_CLUES,
      gameState: "playing",
      imageUrl: "/session.jpg",
      nonce: "nonce-1",
      sessionId: "session-1",
      sessionReady: true,
    });
  });

  it("restores a won session", () => {
    const state = initialGameSessionState({
      initialChallenge: CHALLENGE,
      initialSession: session({
        answerConcentration: "EDP",
        answerName: "N5",
        guesses: [guessItem({ isCorrect: true })],
      }),
      maxAttempts: MAX_ATTEMPTS,
    });

    expect(state.gameState).toBe("won");
    expect(state.dailyPerfume).toMatchObject({
      concentration: "EDP",
      name: "N5",
    });
  });

  it("restores a session lost by the number of attempts", () => {
    const state = initialGameSessionState({
      initialChallenge: CHALLENGE,
      initialSession: session({
        guesses: Array.from({ length: MAX_ATTEMPTS }, () => guessItem()),
      }),
      maxAttempts: MAX_ATTEMPTS,
    });

    expect(state.gameState).toBe("lost");
  });
});

describe("gameSessionReducer", () => {
  it("sessionHydrated: loads the session of the client-side init", () => {
    const initial = initialGameSessionState({ maxAttempts: MAX_ATTEMPTS });

    const state = gameSessionReducer(initial, {
      challenge: CHALLENGE,
      maxAttempts: MAX_ATTEMPTS,
      session: session({
        answerConcentration: "EDP",
        answerName: "N5",
        guesses: [guessItem(), guessItem({ isCorrect: true })],
      }),
      type: "sessionHydrated",
    });

    expect(state.attempts).toHaveLength(2);
    expect(state).toMatchObject({
      clues: SESSION_CLUES,
      dailyPerfume: {
        concentration: "EDP",
        id: "daily",
        imageUrl: "/placeholder.svg",
        name: "N5",
        xsolve: 3,
      },
      gameState: "won",
      imageUrl: "/session.jpg",
      nonce: "nonce-1",
      sessionId: "session-1",
    });
  });

  it("sessionHydrated: keeps the name secret and the image when the session has none", () => {
    const initial = initialGameSessionState({ maxAttempts: MAX_ATTEMPTS });

    const state = gameSessionReducer(initial, {
      challenge: CHALLENGE,
      maxAttempts: MAX_ATTEMPTS,
      session: session({ imageUrl: null }),
      type: "sessionHydrated",
    });

    expect(state.dailyPerfume.name).toBe("Mystery Perfume");
    expect(state.imageUrl).toBe(initial.imageUrl);
    expect(state.gameState).toBe("playing");
  });

  it("sessionReady: marks the session ready", () => {
    const state = gameSessionReducer(playing({ sessionReady: false }), {
      type: "sessionReady",
    });

    expect(state.sessionReady).toBe(true);
  });

  it("lazySessionStarted: stores the new session and marks it ready", () => {
    const state = gameSessionReducer(
      playing({ nonce: "", sessionId: null, sessionReady: false }),
      {
        session: {
          imageUrl: "/lazy.jpg",
          nonce: "lazy-nonce",
          sessionId: "lazy-1",
        },
        type: "lazySessionStarted",
      },
    );

    expect(state).toMatchObject({
      imageUrl: "/lazy.jpg",
      nonce: "lazy-nonce",
      sessionId: "lazy-1",
      sessionReady: true,
    });
  });

  it("lazySessionStarted: keeps the image when the session has none", () => {
    const state = gameSessionReducer(playing({ imageUrl: "/before.jpg" }), {
      session: { imageUrl: null, nonce: "n", sessionId: "s" },
      type: "lazySessionStarted",
    });

    expect(state.imageUrl).toBe("/before.jpg");
  });

  it("guessResolved: appends the attempt and takes clues, nonce and image from the result", () => {
    const state = gameSessionReducer(playing(), {
      guess: GUESS,
      maxAttempts: MAX_ATTEMPTS,
      result: guessResult({ imageUrl: "/step2.jpg" }),
      type: "guessResolved",
    });

    expect(state.attempts).toEqual([
      {
        brand: "Dior",
        concentration: "EDT",
        feedback: FEEDBACK,
        gender: "Male",
        guess: "Sauvage",
        hasGuessedNotes: true,
        isCorrect: false,
        perfumeId: "perfume-9",
        perfumers: ["Creator"],
        year: 2015,
      },
    ]);
    expect(state).toMatchObject({
      clues: NEXT_CLUES,
      gameState: "playing",
      imageUrl: "/step2.jpg",
      nonce: "nonce-2",
    });
  });

  it("guessResolved: keeps nonce and image the result does not carry", () => {
    const state = gameSessionReducer(playing(), {
      guess: GUESS,
      maxAttempts: MAX_ATTEMPTS,
      result: guessResult({ newNonce: "" }),
      type: "guessResolved",
    });

    expect(state).toMatchObject({ imageUrl: "/session.jpg", nonce: "nonce-1" });
  });

  it("guessResolved: a correct guess wins and reveals the answer", () => {
    const state = gameSessionReducer(playing(), {
      guess: GUESS,
      maxAttempts: MAX_ATTEMPTS,
      result: guessResult({
        answerConcentration: "EDP",
        answerName: "Sauvage",
        gameStatus: "won",
        result: "correct",
      }),
      type: "guessResolved",
    });

    expect(state.gameState).toBe("won");
    expect(state.attempts[0]?.isCorrect).toBe(true);
    expect(state.dailyPerfume).toMatchObject({
      concentration: "EDP",
      name: "Sauvage",
    });
  });

  it("guessResolved: the server's lost status loses the game", () => {
    const state = gameSessionReducer(playing(), {
      guess: GUESS,
      maxAttempts: MAX_ATTEMPTS,
      result: guessResult({ answerName: "Sauvage", gameStatus: "lost" }),
      type: "guessResolved",
    });

    expect(state.gameState).toBe("lost");
  });

  it("guessResolved: the last attempt loses the game even when the server says active", () => {
    const state = gameSessionReducer(
      playing({
        attempts: Array.from(
          { length: MAX_ATTEMPTS - 1 },
          () => SKIPPED_ATTEMPT,
        ),
      }),
      {
        guess: GUESS,
        maxAttempts: MAX_ATTEMPTS,
        result: guessResult(),
        type: "guessResolved",
      },
    );

    expect(state.attempts).toHaveLength(MAX_ATTEMPTS);
    expect(state.gameState).toBe("lost");
  });

  it("skipResolved: appends a skipped attempt and takes clues, nonce and image", () => {
    const state = gameSessionReducer(playing(), {
      result: skipResult({ imageUrl: "/step2.jpg" }),
      type: "skipResolved",
    });

    expect(state.attempts).toEqual([SKIPPED_ATTEMPT]);
    expect(state).toMatchObject({
      clues: NEXT_CLUES,
      gameState: "playing",
      imageUrl: "/step2.jpg",
      nonce: "nonce-2",
    });
  });

  it("skipResolved: a lost game reveals the answer", () => {
    const state = gameSessionReducer(playing(), {
      result: skipResult({
        answerConcentration: "EDP",
        answerName: "Sauvage",
        gameStatus: "lost",
      }),
      type: "skipResolved",
    });

    expect(state.gameState).toBe("lost");
    expect(state.dailyPerfume).toMatchObject({
      concentration: "EDP",
      name: "Sauvage",
    });
  });

  it("resetCleared: drops the session but keeps it ready", () => {
    const state = gameSessionReducer(
      playing({ attempts: [SKIPPED_ATTEMPT], gameState: "lost" }),
      { type: "resetCleared" },
    );

    expect(state).toEqual({
      attempts: [],
      clues: HIDDEN_CLUES,
      dailyPerfume: SKELETON_PERFUME,
      gameState: "playing",
      imageUrl: "/placeholder.svg",
      nonce: "",
      sessionId: null,
      sessionReady: true,
    });
  });

  it("resetReloaded: loads the new session with the session id as the image cache buster", () => {
    const cleared = gameSessionReducer(playing(), { type: "resetCleared" });

    const state = gameSessionReducer(cleared, {
      challenge: CHALLENGE,
      session: session({ sessionId: "session-2" }),
      type: "resetReloaded",
    });

    expect(state).toMatchObject({
      attempts: [],
      clues: SESSION_CLUES,
      dailyPerfume: {
        concentration: undefined,
        id: "daily",
        imageUrl: "/placeholder.svg",
        name: "Mystery Perfume",
        xsolve: 3,
      },
      gameState: "playing",
      imageUrl: "/session.jpg?reset=session-2",
      nonce: "nonce-1",
      sessionId: "session-2",
    });
  });

  it("resetReloaded: falls back to the placeholder image when the session has none", () => {
    const state = gameSessionReducer(playing(), {
      challenge: CHALLENGE,
      session: session({ imageUrl: null }),
      type: "resetReloaded",
    });

    expect(state.imageUrl).toBe("/placeholder.svg");
  });

  it("does not mutate the previous state", () => {
    const before = playing();
    const snapshot = structuredClone(before);

    gameSessionReducer(before, {
      guess: GUESS,
      maxAttempts: MAX_ATTEMPTS,
      result: guessResult(),
      type: "guessResolved",
    });

    expect(before).toEqual(snapshot);
  });
});
