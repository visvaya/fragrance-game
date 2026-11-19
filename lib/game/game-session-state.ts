import { GENERIC_PLACEHOLDER } from "@/lib/constants";
import { HIDDEN_CLUES, type RevealedClues } from "@/lib/game/clue-reveal";

import type {
  DailyChallenge,
  SkipAttemptResult,
  StartGameResponse,
  SubmitGuessResult,
} from "@/app/actions/game-actions";
import type { AttemptFeedback } from "@/lib/game/guess-feedback";

/** One row of the guess log: a guessed perfume with its feedback, or a skip. */
export type Attempt = {
  brand: string;
  concentration?: string | undefined;
  feedback: AttemptFeedback;
  gender?: string | undefined;
  guess: string;
  hasGuessedNotes?: boolean; // True if guessed perfume has notes data
  isCorrect?: boolean;
  isSkipped?: boolean;
  perfumeId?: string;
  perfumers?: string[] | undefined;
  year?: number | undefined;
};

/** Progress of the day's game. */
export type GameState = "playing" | "won" | "lost";

/**
 * Public data of the daily perfume. Clue values (brand, notes, year...) live in
 * RevealedClues, computed on the server; the answer itself never reaches the browser.
 */
export type DailyPerfume = {
  concentration: string | undefined;
  id: string;
  imageUrl: string;
  name: string;
  xsolve: number;
};

/** Everything the game rules decide about one session; UI and auth state live elsewhere. */
export type GameSessionState = {
  attempts: Attempt[];
  clues: RevealedClues;
  dailyPerfume: DailyPerfume;
  gameState: GameState;
  imageUrl: string;
  nonce: string;
  sessionId: string | null;
  sessionReady: boolean;
};

const PLACEHOLDER_IMAGE_URL = "/placeholder.svg?height=400&width=400";

/** Placeholder daily perfume shown while the real challenge loads (avoids null checks). */
export const SKELETON_PERFUME: DailyPerfume = {
  concentration: undefined,
  id: "skeleton",
  imageUrl: PLACEHOLDER_IMAGE_URL,
  name: GENERIC_PLACEHOLDER.repeat(5),
  xsolve: 0,
};

/** Row appended to the log when the player skips; nothing matched. */
export const SKIPPED_ATTEMPT: Attempt = {
  brand: "",
  feedback: {
    brandMatch: false,
    genderMatch: false,
    notesMatch: 0,
    perfumerMatch: "none",
    yearDirection: "equal",
    yearMatch: "wrong",
  },
  guess: "",
  isCorrect: false,
  isSkipped: true,
};

type GameSessionInit = {
  initialChallenge?:
    | Pick<DailyChallenge, "revealed" | "xsolve">
    | null
    | undefined;
  initialImageUrl?: string | null | undefined;
  initialSession?: StartGameResponse | null | undefined;
  maxAttempts: number;
};

/** What a state change needs to know about a challenge. */
type ChallengeInfo = Pick<DailyChallenge, "xsolve">;

/** Changes of the game session state; each one is a transition of {@link gameSessionReducer}. */
export type GameSessionAction =
  | {
      guess: { brand: string; perfumeId: string; perfumeName: string };
      maxAttempts: number;
      result: SubmitGuessResult;
      type: "guessResolved";
    }
  | {
      session: Pick<StartGameResponse, "imageUrl" | "nonce" | "sessionId">;
      type: "lazySessionStarted";
    }
  | {
      challenge: ChallengeInfo;
      session: StartGameResponse;
      type: "resetReloaded";
    }
  | { type: "resetCleared" }
  | { result: SkipAttemptResult; type: "skipResolved" }
  | {
      challenge: ChallengeInfo;
      maxAttempts: number;
      session: StartGameResponse;
      type: "sessionHydrated";
    }
  | { type: "sessionReady" };

/**
 * Maps the server guess history to attempts. Feedback comes from the server as is,
 * so the browser never compares guesses with the answer.
 */
function hydrateAttempts(
  guesses: StartGameResponse["guesses"] | undefined,
): Attempt[] {
  if (!guesses) return [];
  return guesses.map((g) =>
    g.isSkip
      ? {
          brand: "",
          feedback: g.feedback,
          guess: "",
          isCorrect: false,
          isSkipped: true,
        }
      : {
          brand: g.brandName,
          concentration: g.concentration,
          feedback: g.feedback,
          gender: g.gender,
          guess: g.perfumeName,
          isCorrect: g.isCorrect,
          perfumeId: g.perfumeId,
          perfumers: g.perfumers,
          year: g.year,
        },
  );
}

function gameStateFromGuesses(
  guesses: StartGameResponse["guesses"],
  maxAttempts: number,
): GameState {
  if (guesses.at(-1)?.isCorrect) return "won";
  if (guesses.length >= maxAttempts) return "lost";
  return "playing";
}

/** The daily perfume before the answer is known: the name stays secret. */
function mysteryPerfume({ xsolve }: ChallengeInfo): DailyPerfume {
  return {
    concentration: undefined,
    id: "daily",
    imageUrl: "/placeholder.svg",
    name: "Mystery Perfume",
    xsolve,
  };
}

/** Fills in the answer once the server sends it (game over). */
function withAnswer(
  perfume: DailyPerfume,
  answer: {
    answerConcentration?: string | undefined;
    answerName?: string | undefined;
  },
): DailyPerfume {
  return answer.answerName
    ? {
        ...perfume,
        concentration: answer.answerConcentration,
        name: answer.answerName,
      }
    : perfume;
}

/**
 * State of the first render: the SSR session when there is one, the SSR challenge's clues
 * without a session, nothing otherwise (the client then loads everything).
 */
export function initialGameSessionState({
  initialChallenge,
  initialImageUrl,
  initialSession,
  maxAttempts,
}: GameSessionInit): GameSessionState {
  return {
    attempts: hydrateAttempts(initialSession?.guesses),
    clues:
      initialSession?.revealed ?? initialChallenge?.revealed ?? HIDDEN_CLUES,
    dailyPerfume: initialChallenge
      ? {
          concentration: initialSession?.answerConcentration,
          id: "daily",
          imageUrl: initialImageUrl ?? PLACEHOLDER_IMAGE_URL,
          name: initialSession?.answerName ?? "Mystery Perfume",
          xsolve: initialChallenge.xsolve,
        }
      : SKELETON_PERFUME,
    gameState: initialSession
      ? gameStateFromGuesses(initialSession.guesses, maxAttempts)
      : "playing",
    imageUrl:
      initialSession?.imageUrl ?? initialImageUrl ?? PLACEHOLDER_IMAGE_URL,
    nonce: initialSession?.nonce ?? "",
    sessionId: initialSession?.sessionId ?? null,
    sessionReady: initialSession !== null && initialSession !== undefined,
  };
}

function applyGuess(
  state: GameSessionState,
  {
    guess,
    maxAttempts,
    result,
  }: Extract<GameSessionAction, { type: "guessResolved" }>,
): GameSessionState {
  const attempt: Attempt = {
    brand: guess.brand,
    concentration: result.guessedPerfumeDetails?.concentration,
    feedback: result.feedback,
    gender: result.guessedPerfumeDetails?.gender,
    guess: guess.perfumeName,
    hasGuessedNotes: result.hasGuessedNotes,
    isCorrect: result.result === "correct",
    perfumeId: guess.perfumeId,
    perfumers: result.guessedPerfumers,
    year: result.guessedPerfumeDetails?.year,
  };
  const isOver =
    result.gameStatus === "lost" || state.attempts.length + 1 >= maxAttempts;
  return {
    ...state,
    attempts: [...state.attempts, attempt],
    clues: result.revealed,
    dailyPerfume: withAnswer(state.dailyPerfume, result),
    gameState:
      result.gameStatus === "won" ? "won" : isOver ? "lost" : state.gameState,
    imageUrl: result.imageUrl || state.imageUrl,
    nonce: result.newNonce || state.nonce,
  };
}

function applySkip(
  state: GameSessionState,
  { result }: Extract<GameSessionAction, { type: "skipResolved" }>,
): GameSessionState {
  const isLost = result.gameStatus === "lost";
  return {
    ...state,
    attempts: [...state.attempts, SKIPPED_ATTEMPT],
    clues: result.revealed,
    dailyPerfume: isLost
      ? withAnswer(state.dailyPerfume, result)
      : state.dailyPerfume,
    gameState: isLost ? "lost" : state.gameState,
    imageUrl: result.imageUrl || state.imageUrl,
    nonce: result.newNonce || state.nonce,
  };
}

function applyHydration(
  state: GameSessionState,
  {
    challenge,
    maxAttempts,
    session,
  }: Extract<GameSessionAction, { type: "sessionHydrated" }>,
): GameSessionState {
  return {
    ...state,
    attempts: hydrateAttempts(session.guesses),
    clues: session.revealed,
    dailyPerfume: withAnswer(mysteryPerfume(challenge), session),
    gameState: gameStateFromGuesses(session.guesses, maxAttempts),
    imageUrl: session.imageUrl || state.imageUrl,
    nonce: session.nonce,
    sessionId: session.sessionId,
  };
}

/** Pure transitions of the game session; every change the game rules make goes through here. */
export function gameSessionReducer(
  state: GameSessionState,
  action: GameSessionAction,
): GameSessionState {
  switch (action.type) {
    case "guessResolved": {
      return applyGuess(state, action);
    }
    case "lazySessionStarted": {
      return {
        ...state,
        imageUrl: action.session.imageUrl || state.imageUrl,
        nonce: action.session.nonce,
        sessionId: action.session.sessionId,
        sessionReady: true,
      };
    }
    case "resetCleared": {
      return {
        ...state,
        attempts: [],
        clues: HIDDEN_CLUES,
        dailyPerfume: SKELETON_PERFUME,
        gameState: "playing",
        imageUrl: "/placeholder.svg",
        nonce: "",
        sessionId: null,
      };
    }
    case "resetReloaded": {
      const { challenge, session } = action;
      return {
        ...state,
        clues: session.revealed,
        dailyPerfume: mysteryPerfume(challenge),
        // The session id makes the URL new, so the browser does not show the cached image.
        imageUrl: session.imageUrl
          ? `${session.imageUrl}?reset=${session.sessionId}`
          : "/placeholder.svg",
        nonce: session.nonce,
        sessionId: session.sessionId,
      };
    }
    case "sessionHydrated": {
      return applyHydration(state, action);
    }
    case "sessionReady": {
      return { ...state, sessionReady: true };
    }
    case "skipResolved": {
      return applySkip(state, action);
    }
  }
}
