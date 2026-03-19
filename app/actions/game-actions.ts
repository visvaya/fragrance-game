"use server";

import { revalidatePath, unstable_cache } from "next/cache";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { trackEvent, identifyUser } from "@/lib/analytics-server";
import { MAX_GUESSES } from "@/lib/constants";
import { env } from "@/lib/env";
import {
  calculateBaseScore,
  calculateFinalScore,
  getRevealPercentages,
  type RevealState,
} from "@/lib/game/scoring";
import { checkRateLimit } from "@/lib/redis";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { GameSessionsUpdate } from "@/lib/validations/supabase.schema";

// --- Types ---

export type DailyChallenge = {
  challenge_date: string;
  // Public clues (safe to expose, progressively masked on client)
  clues: {
    brand: string;
    concentration: string;
    gender: string;
    // accords removed as per user request
    isLinear: boolean;
    notes: {
      base: string[];
      heart: string[];
      top: string[];
    };
    perfumer: string;
    xsolve: number;
    year: number;
  };
  grace_deadline_at_utc: string;
  id: string;
  mode: string;
  snapshot_metadata: Record<string, unknown>;
};

type GuessHistoryItem = {
  brandName: string;
  concentration?: string;
  feedback?: AttemptFeedback;
  gender?: string;
  isCorrect: boolean;
  isSkip?: boolean;
  perfumeId: string;
  perfumeName: string;
  perfumers?: string[];
  timestamp: string;
  year?: number;
};

export type StartGameResponse = {
  answerConcentration?: string;
  answerName?: string;
  graceDeadline: string;
  guesses: GuessHistoryItem[];
  imageUrl: string | null;
  nonce: string;
  revealState: RevealState;
  sessionId: string;
};

type InitializeGameResponse = {
  challenge: DailyChallenge | null;
  session: StartGameResponse | null;
};

type AttemptFeedback = {
  brandMatch: boolean;
  notesMatch: number; // 0-1 matches
  perfumerMatch: "full" | "partial" | "none";
  yearDirection: "higher" | "lower" | "equal";
  yearMatch: "correct" | "close" | "wrong";
};

export type SubmitGuessResult = {
  answerConcentration?: string;
  answerName?: string;
  feedback: AttemptFeedback;
  finalScore?: number;
  gameStatus: "active" | "won" | "lost";
  guessedPerfumeDetails?: {
    concentration: string;
    gender: string;
    year: number;
  };
  guessedPerfumers?: string[];
  hasGuessedNotes: boolean;
  imageUrl?: string | null;
  message?: string;
  newNonce: string;
  result: "correct" | "incorrect";
  revealState: RevealState;
};

export type SkipAttemptResult = {
  answerConcentration?: string;
  answerName?: string;
  gameStatus: "active" | "won" | "lost";
  imageUrl?: string | null;
  newNonce: string;
};

// --- Helpers ---

/**
 * Normalizuje nazwę nuty zapachowej do porównań. Usuwa znaki towarowe i zbędne określenia.
 */
function cleanNote(note: string | null | undefined): string {
  if (typeof note !== "string") return "";
  const removeWords = [
    "absolute",
    "scenttrek",
    "orpur",
    "co2",
    "concrete",
    "otto",
    "nectar",
    "material",
    "resinoid",
    "oxide",
  ];
  // eslint-disable-next-line unicorn/no-array-reduce -- reduce is appropriate here for building a cleaned string immutably
  const cleanedNote = removeWords.reduce(
    (cleanedAccumulator, word) =>
      cleanedAccumulator.replaceAll(
        new RegExp(String.raw`\b${word}\b`, "gi"),
        "",
      ),
    note
      .trim()
      .replaceAll(/[™®]/g, "")
      .replaceAll(/\bLa Réunion\b/gi, ""),
  );
  const t = cleanedNote
    // eslint-disable-next-line sonarjs/slow-regex -- /\([^)]*\)/ uses nested quantifier flagged by Sonar; bounded by explicit parentheses, no catastrophic backtracking risk
    .replaceAll(/\([^)]*\)/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/[,-]$/, "")
    .trim();
  return t.toLowerCase();
}

/**
 * Oblicza podobieństwo Jaccarda między nutami zgadniętymi a poprawnymi.
 */
function calculateNotesMatch(
  guessNotes: { base: string[]; heart: string[]; top: string[] },
  answerNotes: { base: string[]; heart: string[]; top: string[] },
): number {
  const guessSet = new Set([
    ...guessNotes.top.map((n) => cleanNote(n)),
    ...guessNotes.heart.map((n) => cleanNote(n)),
    ...guessNotes.base.map((n) => cleanNote(n)),
  ]);

  const answerSet = new Set([
    ...answerNotes.top.map((n) => cleanNote(n)),
    ...answerNotes.heart.map((n) => cleanNote(n)),
    ...answerNotes.base.map((n) => cleanNote(n)),
  ]);

  const intersection = new Set(
    [...guessSet].filter((note) => answerSet.has(note)),
  );
  const union = new Set([...guessSet, ...answerSet]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Sprawdza dopasowanie twórców (perfumiarzy).
 */
function calculatePerfumerMatch(
  guessPerfumers: (string | null | undefined)[] | null,
  answerPerfumers: (string | null | undefined)[] | null,
): "full" | "partial" | "none" {
  if (!guessPerfumers || !answerPerfumers) return "none";

  const guessSet = new Set(
    guessPerfumers
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => p.toLowerCase().trim()),
  );
  const answerSet = new Set(
    answerPerfumers
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => p.toLowerCase().trim()),
  );

  if (guessSet.size === 0 || answerSet.size === 0) return "none";

  const matchCount = [...guessSet].filter((p) => answerSet.has(p)).length;

  if (matchCount === answerSet.size && guessSet.size === answerSet.size)
    return "full";
  if (matchCount > 0) return "partial";
  return "none";
}

/**
 * Generates a cryptographically secure nonce as a string.
 * Uses 6 random bytes (48 bits) to stay well within Number.MAX_SAFE_INTEGER
 * (2^53 - 1), so the value survives JS number round-trips through Supabase
 * without precision loss.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const value = bytes.reduce(
    (accumulator, byte) => accumulator * 256 + byte,
    0,
  );
  return value.toString();
}

// --- Actions ---

/**
 * Pobiera dane codziennego wyzwania (widok publiczny + detale od admina).
 */
export async function getDailyChallenge(): Promise<DailyChallenge | null> {
  const supabase = await createClient();

  // Rate limiting
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await checkRateLimit("getDailyChallenge", user.id);
    }
  } catch {
    // Continue even if rate limit check fails
  }

  const targetDate = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("daily_challenges_public")
    .select(
      "challenge_date, grace_deadline_at_utc, id, mode, snapshot_metadata",
    )
    .eq("challenge_date", targetDate)
    .limit(1)
    .single();

  if (error) {
    if (
      typeof error === "object" &&
      "code" in error &&
      error.code === "PGRST116"
    ) {
      console.warn("[getDailyChallenge] No challenge found (PGRST116)");
      return null;
    }
    console.error("Error fetching daily challenge:", error);
    throw new Error("Failed to fetch daily challenge");
  }

  if (data.id == null) {
    throw new Error("Challenge id is missing from public view");
  }

  const adminSupabase = createAdminClient();
  const { data: challengePrivate } = await adminSupabase
    .from("daily_challenges")
    .select("perfume_id")
    .eq("id", data.id)
    .single();

  if (!challengePrivate) {
    throw new Error("Challenge integrity error");
  }

  const { data: perfume } = (await adminSupabase
    .from("perfumes")
    .select(
      `
            name,
            release_year,
            gender,
            is_linear,
            xsolve_score,
            top_notes,
            middle_notes,
            base_notes,
            perfumers,
            brands (name),
            concentrations (name)
        `,
    )
    .eq("id", challengePrivate.perfume_id)
    .single()) as {
    data: {
      base_notes: string[] | null;
      brands: { name: string } | null;
      concentrations: { name: string } | null;
      gender: string | null;
      is_linear: boolean | null;
      middle_notes: string[] | null;
      name: string;
      perfumers: string[] | null;
      release_year: number | null;
      top_notes: string[] | null;
      xsolve_score: number | null;
    } | null;
  };

  if (!perfume) {
    throw new Error("Perfume not found for challenge");
  }

  // CRITICAL: xsolve_score must be present for difficulty calculation
  // This should never happen if eligible_perfumes view is used correctly,
  // but we validate defensively to catch any manual insertions or bugs.
  if (perfume.xsolve_score == null) {
    throw new Error(
      `Perfume ${perfume.name} (ID: ${challengePrivate.perfume_id}) has no xsolve_score. ` +
        "Only perfumes with calculated difficulty scores can be used in challenges.",
    );
  }

  const brandName =
    (perfume.brands as { name: string } | null)?.name ?? "Unknown";
  const concentrationName =
    (perfume.concentrations as { name: string } | null)?.name ?? "Unknown";

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- daily_challenges_public view returns nullable fields; critical ones validated above; brands/concentrations need narrowing from Supabase join type
  return {
    ...data,
    clues: {
      brand: brandName,
      concentration: concentrationName,
      gender: perfume.gender || "Unknown", // "Unknown" for missing gender (works in both attempt-log and meta-clues)
      isLinear: perfume.is_linear ?? false,
      notes: {
        base: perfume.base_notes ?? [],
        heart: perfume.middle_notes ?? [],
        top: perfume.top_notes ?? [],
      },
      perfumer:
        perfume.perfumers && perfume.perfumers.length > 0
          ? perfume.perfumers.join(", ")
          : "Unknown",
      xsolve: perfume.xsolve_score, // Now guaranteed to be a number
      year: perfume.release_year ?? 0, // Keep 0 for year - it's checked as !year || year === 0
    },
  } as DailyChallenge;
}

type RawGuess = {
  feedback?: AttemptFeedback;
  isCorrect: boolean;
  isSkip?: boolean;
  perfumeId: string;
  timestamp: string;
};

async function enrichGuessesWithPerfumeDetails(
  rawGuesses: RawGuess[],
): Promise<GuessHistoryItem[]> {
  if (rawGuesses.length === 0) return [];

  type PerfumeRow = {
    brands: { name: string } | null;
    concentrations: { name: string } | null;
    gender: string | null;
    id: string;
    name: string;
    perfumers: string[] | null;
    release_year: number | null;
  };

  const adminSupabase = createAdminClient();
  const realGuessIds = rawGuesses
    .filter((g) => !g.isSkip)
    .map((g) => g.perfumeId);

  const perfumeMap = await (async () => {
    if (realGuessIds.length === 0) return new Map<string, PerfumeRow>();
    const { data: perfumes } = (await adminSupabase
      .from("perfumes")
      .select(
        "id, name, brands(name), release_year, concentrations(name), gender, perfumers",
      )
      .in("id", realGuessIds)) as { data: PerfumeRow[] | null };
    return perfumes
      ? new Map(perfumes.map((p) => [p.id, p]))
      : new Map<string, PerfumeRow>();
  })();

  return rawGuesses.flatMap((guess): GuessHistoryItem[] => {
    if (guess.isSkip) {
      return [
        {
          brandName: "",
          isCorrect: false,
          isSkip: true,
          perfumeId: "",
          perfumeName: "",
          timestamp: guess.timestamp,
        },
      ];
    }
    const p = perfumeMap.get(guess.perfumeId);
    if (!p) return [];
    return [
      {
        brandName: (p.brands as { name: string } | null)?.name ?? "Unknown",
        concentration: (p.concentrations as { name: string } | null)?.name,
        feedback: guess.feedback,
        gender: p.gender ?? undefined,
        isCorrect: guess.isCorrect,
        perfumeId: guess.perfumeId,
        perfumeName: p.name,
        perfumers: p.perfumers ?? [],
        timestamp: guess.timestamp,
        year: p.release_year ?? undefined,
      },
    ];
  });
}

async function createNewGameSession(
  challengeId: string,
  safeInheritedCount: number,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<StartGameResponse> {
  await checkRateLimit("startGame", userId);

  const nonce = generateNonce();
  const { data: session, error: insertError } = (await supabase
    .from("game_sessions")
    .insert({
      attempts_count: safeInheritedCount,
      challenge_id: challengeId,
      guesses: [],
      last_guess: null,
      last_nonce: nonce,
      player_id: userId,
      start_time: new Date().toISOString(),
      status: "active",
    })
    .select(
      "attempts_count, challenge_id, id, last_nonce, player_id, start_time, status",
    )
    .limit(1)
    .single()) as {
    data: {
      attempts_count: number;
      challenge_id: string;
      id: string;
      last_nonce: string | number;
      player_id: string;
      start_time: string;
      status: string;
    } | null;
    error: Error | null;
  };

  if (insertError || !session) {
    console.error("Error starting game:", insertError);
    throw new Error("Failed to create session");
  }

  const imageUrl = await getImageUrlForStep(session.id);
  const { data: challengeData } = (await supabase
    .from("daily_challenges_public")
    .select("mode, grace_deadline_at_utc")
    .eq("id", challengeId)
    .single()) as {
    data: { grace_deadline_at_utc: string; mode: string } | null;
  };

  Sentry.setUser({ id: userId });
  await identifyUser(userId);
  await trackEvent(
    "game_started",
    {
      challenge_id: challengeId,
      mode: challengeData?.mode ?? "daily",
      session_id: session.id,
    },
    userId,
  );

  return {
    graceDeadline: challengeData?.grace_deadline_at_utc ?? "",
    guesses: [],
    imageUrl: imageUrl,
    nonce: nonce,
    revealState: getRevealPercentages(safeInheritedCount + 1),
    sessionId: session.id,
  };
}

/**
 * Rozpoczyna nową sesję gry lub wznawia istniejącą.
 */
export async function startGame(
  challengeId: string,
  inheritedAttemptCount = 0,
): Promise<StartGameResponse> {
  z.uuid().parse(challengeId);
  z.number().int().min(0).max(5).parse(inheritedAttemptCount);
  // Clamp to a safe range: 0–5 (6 would mean the game is already over)
  const safeInheritedCount = Math.max(0, Math.min(5, inheritedAttemptCount));
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Authentication is required; getSession() fallback removed per CLAUDE.md
  // getUser() performs proper JWT validation

  if (!user) {
    console.error("Auth error in startGame:", userError);
    throw new Error("Unauthorized");
  }

  const { data: existingSession } = (await supabase
    .from("game_sessions")
    .select("id, last_nonce, attempts_count, guesses, status")
    .eq("player_id", user.id)
    .eq("challenge_id", challengeId)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data: {
      attempts_count: number;
      guesses:
        | {
            feedback?: AttemptFeedback;
            isCorrect: boolean;
            perfumeId: string;
            timestamp: string;
          }[]
        | null;
      id: string;
      last_nonce: string | number;
      status: string;
    } | null;
  };

  if (existingSession) {
    const { data: graceQuery } = (await supabase
      .from("daily_challenges_public")
      .select("grace_deadline_at_utc")
      .eq("id", challengeId)
      .single()) as { data: { grace_deadline_at_utc: string } | null };

    const imageUrl = await getImageUrlForStep(existingSession.id);
    const rawGuesses = existingSession.guesses ?? [];
    const enrichedGuesses = await enrichGuessesWithPerfumeDetails(rawGuesses);

    const { answerConcentration, answerName } = await (async () => {
      if (existingSession.status !== "won" && existingSession.status !== "lost")
        return { answerConcentration: undefined, answerName: undefined };
      const adminSupabase = createAdminClient();
      const { data: challenge } = await adminSupabase
        .from("daily_challenges")
        .select("perfume_id")
        .eq("id", challengeId)
        .single();
      if (!challenge)
        return { answerConcentration: undefined, answerName: undefined };
      const { data: p } = (await adminSupabase
        .from("perfumes")
        .select("name, concentrations(name)")
        .eq("id", challenge.perfume_id)
        .single()) as {
        data: {
          concentrations: { name: string } | null;
          name: string;
        } | null;
      };
      return {
        answerConcentration: (p?.concentrations as { name: string } | null)
          ?.name,
        answerName: p?.name,
      };
    })();

    return {
      answerConcentration,
      answerName,
      graceDeadline: graceQuery?.grace_deadline_at_utc ?? "",
      guesses: enrichedGuesses,
      imageUrl: imageUrl,
      nonce: String(existingSession.last_nonce),
      revealState: getRevealPercentages(existingSession.attempts_count + 1),
      sessionId: existingSession.id,
    };
  }

  // Rate limiting: only applies to creating NEW sessions, not resuming existing ones
  return createNewGameSession(
    challengeId,
    safeInheritedCount,
    user.id,
    supabase,
  );
}

/**
 * Inicjalizuje grę, pobierając wyzwanie i rozpoczynając sesję.
 */
export async function initializeGame(
  inheritedAttemptCount = 0,
): Promise<InitializeGameResponse> {
  z.number().int().min(0).max(5).parse(inheritedAttemptCount);

  const challenge = await getDailyChallenge().catch(() => null);
  if (!challenge) return { challenge: null, session: null };

  try {
    const session = await startGame(challenge.id, inheritedAttemptCount);
    return { challenge, session };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      console.warn("initializeGame: Unauthorized, returning challenge only.");
      return { challenge, session: null };
    }
    console.error("Error in initializeGame:", error);
    return { challenge: null, session: null };
  }
}

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(uuidRegex, "Invalid UUID");

/**
 * Pobiera URL obrazka dla danego etapu gry.
 */
async function getImageUrlForStep(sessionId: string): Promise<string | null> {
  if (!uuidSchema.safeParse(sessionId).success) {
    throw new Error("Invalid session ID");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Authentication is required; getSession() fallback removed per CLAUDE.md
  // getUser() performs proper JWT validation

  if (!user) {
    console.error("getImageUrlForStep: Unauthorized access", {
      sessionId,
      userError,
    });
    throw new Error("Unauthorized");
  }

  const { data: session, error: sessionError } = (await supabase
    .from("game_sessions")
    .select("challenge_id, attempts_count, player_id, status")
    .eq("id", sessionId)
    .single()) as {
    data: {
      attempts_count: number;
      challenge_id: string;
      player_id: string;
      status: string;
    } | null;
    error: Error | null;
  };

  if (sessionError || !session) throw new Error("Session not found");
  if (session.player_id !== user.id) throw new Error("Unauthorized");

  const adminSupabase = createAdminClient();
  const { data: challenge } = await adminSupabase
    .from("daily_challenges")
    .select("perfume_id")
    .eq("id", session.challenge_id)
    .single();

  if (!challenge) throw new Error("Challenge not found");

  const { data: assets } = await adminSupabase
    .from("perfume_assets")
    .select(
      "image_key_step_1, image_key_step_2, image_key_step_3, image_key_step_4, image_key_step_5, image_key_step_6",
    )
    .eq("perfume_id", challenge.perfume_id)
    .single();

  if (!assets) {
    console.warn(`No assets found for perfume ${challenge.perfume_id}`);
    return "https://placehold.co/512x512?text=No+Asset";
  }

  const isRevealed = session.status === "won" || session.status === "lost";
  const step = isRevealed
    ? 6
    : Math.min(session.attempts_count + 1, MAX_GUESSES);
  const key = (assets as Record<string, string>)[`image_key_step_${step}`];

  const assetsHost = env.NEXT_PUBLIC_ASSETS_HOST ?? "assets.eauxle.com";
  return `https://${assetsHost}/${key}`;
}

type PerfumeForFeedback = {
  base_notes: string[] | null;
  brand_id: string;
  middle_notes: string[] | null;
  perfumers: string[] | null;
  release_year: number | null;
  top_notes: string[] | null;
};

function getYearMatch(yearDiff: number): "correct" | "close" | "wrong" {
  if (yearDiff === 0) return "correct";
  if (Math.abs(yearDiff) <= 3) return "close";
  return "wrong";
}

function getYearDirection(yearDiff: number): "lower" | "higher" | "equal" {
  if (yearDiff > 0) return "lower";
  if (yearDiff < 0) return "higher";
  return "equal";
}

function calculateFeedback(
  guessedPerfume: PerfumeForFeedback,
  answerPerfume: PerfumeForFeedback,
): AttemptFeedback {
  const yearDiff =
    (guessedPerfume.release_year ?? 0) - (answerPerfume.release_year ?? 0);

  return {
    brandMatch: guessedPerfume.brand_id === answerPerfume.brand_id,
    notesMatch: calculateNotesMatch(
      {
        base: guessedPerfume.base_notes ?? [],
        heart: guessedPerfume.middle_notes ?? [],
        top: guessedPerfume.top_notes ?? [],
      },
      {
        base: answerPerfume.base_notes ?? [],
        heart: answerPerfume.middle_notes ?? [],
        top: answerPerfume.top_notes ?? [],
      },
    ),
    perfumerMatch: calculatePerfumerMatch(
      guessedPerfume.perfumers ?? null,
      answerPerfume.perfumers ?? null,
    ),
    yearDirection: getYearDirection(yearDiff),
    yearMatch: getYearMatch(yearDiff),
  };
}

/**
 * Wysyła zgadnięcie użytkownika i aktualizuje stan gry.
 * The function orchestrates multiple async operations (auth, DB reads/writes, analytics)
 * that form a single atomic business transaction; extraction would scatter this logic.
 */
// eslint-disable-next-line sonarjs/max-lines-per-function -- orchestrates multi-step game transaction: auth, DB ops, scoring, analytics; each step is cohesive with shared state
export async function submitGuess(
  sessionId: string,
  perfumeId: string,
  clientNonce: string,
): Promise<SubmitGuessResult> {
  if (!uuidSchema.safeParse(sessionId).success) {
    throw new Error("Invalid session ID");
  }
  if (!uuidSchema.safeParse(perfumeId).success) {
    throw new Error("Invalid perfume ID");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Authentication is required; getSession() fallback removed per CLAUDE.md
  // getUser() performs proper JWT validation

  if (!user) {
    console.error("submitGuess: Unauthorized access", { sessionId, userError });
    throw new Error("Unauthorized");
  }

  // Rate limiting
  await checkRateLimit("submitGuess", user.id);

  const { data: session, error: sessionError } = (await supabase
    .from("game_sessions")
    .select(
      "id, last_nonce, status, attempts_count, challenge_id, player_id, guesses, start_time",
    )
    .eq("id", sessionId)
    .limit(1)
    .single()) as {
    data: {
      attempts_count: number;
      challenge_id: string;
      guesses:
        | {
            feedback?: AttemptFeedback;
            isCorrect: boolean;
            perfumeId: string;
            timestamp: string;
          }[]
        | null;
      id: string;
      last_nonce: string | number;
      player_id: string;
      start_time: string;
      status: string;
    } | null;
    error: Error | null;
  };

  if (sessionError || !session) {
    throw new Error("Session not found");
  }

  if (String(session.last_nonce) !== clientNonce) {
    throw new Error(`CONFLICT:${session.last_nonce}`);
  }

  if (session.status !== "active") {
    return {
      feedback: {
        brandMatch: false,
        notesMatch: 0,
        perfumerMatch: "none",
        yearDirection: "equal",
        yearMatch: "wrong",
      },
      gameStatus: session.status as SubmitGuessResult["gameStatus"],
      hasGuessedNotes: false,
      newNonce: String(session.last_nonce),
      result: "incorrect",
      revealState: getRevealPercentages(6),
    };
  }

  const adminSupabase = createAdminClient();
  const { data: challenge } = await adminSupabase
    .from("daily_challenges")
    .select("perfume_id, grace_deadline_at_utc")
    .eq("id", session.challenge_id)
    .single();

  if (!challenge) {
    throw new Error("Challenge data missing");
  }

  const isCorrect = perfumeId === challenge.perfume_id;
  const nextAttempts = session.attempts_count + 1;
  const isGameOver = isCorrect || nextAttempts >= MAX_GUESSES;

  type PerfumeData = {
    base_notes: string[] | null;
    brand_id: string;
    concentration_id?: string;
    concentrations: { name: string } | { name: string }[] | null;
    gender?: string | null;
    middle_notes: string[] | null;
    name?: string;
    perfumers: string[] | null; // FIX: Array of strings, not objects
    release_year: number | null;
    top_notes: string[] | null;
  };

  const [guessedPerfumeResult, answerPerfumeResult] = (await Promise.all([
    adminSupabase
      .from("perfumes")
      .select(
        "brand_id, release_year, top_notes, middle_notes, base_notes, perfumers, concentration_id, concentrations(name), gender",
      )
      .eq("id", perfumeId)
      .limit(1)
      .single(),
    adminSupabase
      .from("perfumes")
      .select(
        "name, brand_id, release_year, top_notes, middle_notes, base_notes, perfumers, concentrations(name)",
      )
      .eq("id", challenge.perfume_id)
      .limit(1)
      .single(),
  ])) as [
    { data: PerfumeData | null; error: Error | null },
    { data: PerfumeData | null; error: Error | null },
  ];

  const guessedPerfume = guessedPerfumeResult.data;
  const answerPerfume = answerPerfumeResult.data;

  if (!guessedPerfume || !answerPerfume) {
    throw new Error("Perfume data missing");
  }

  const feedback = calculateFeedback(guessedPerfume, answerPerfume);

  const newNonce = generateNonce();
  const guessEntry = {
    feedback,
    isCorrect,
    perfumeId,
    timestamp: new Date().toISOString(),
  };

  const newStatus: SubmitGuessResult["gameStatus"] = (() => {
    if (!isGameOver) return "active";
    return isCorrect ? "won" : "lost";
  })();

  const updatePayload = {
    attempts_count: nextAttempts,
    guesses: [
      ...((session.guesses ?? []) as unknown as AttemptFeedback[]),
      guessEntry,
    ],
    last_guess: new Date().toISOString(),
    last_nonce: newNonce,
    status: newStatus,
  };

  try {
    // Validate update payload with Zod
    // Note: Zod 'any()' for JSON fields is lenient, but ensures object structure matches
    GameSessionsUpdate.parse(updatePayload);
  } catch (error) {
    console.error("Game session update validation failed:", error);
    throw new Error("Game state validation failed");
  }

  const { data: updatedSession, error: updateError } = await supabase
    .from("game_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("last_nonce", clientNonce)
    .select(
      "attempts_count, challenge_id, guesses, id, last_guess, last_nonce, player_id, start_time, status",
    )
    .limit(1)
    .single();

  if (updateError) {
    throw new Error(`CONFLICT:${session.last_nonce}`);
  }

  await trackEvent(
    "guess_submitted",
    {
      attempt_number: nextAttempts,
      challenge_id: session.challenge_id,
      is_correct: isCorrect,
      perfume_id: perfumeId,
      session_id: sessionId,
    },
    user.id,
  );

  const finalScore = await (async () => {
    if (!isGameOver) return 0;
    const { data: targetPerfume } = (await adminSupabase
      .from("perfumes")
      .select("xsolve_score")
      .eq("id", challenge.perfume_id)
      .single()) as { data: { xsolve_score: number } | null };

    const xScore = targetPerfume?.xsolve_score ?? 0;
    const baseScore = isCorrect ? calculateBaseScore(nextAttempts) : 0;
    const score = isCorrect ? calculateFinalScore(baseScore, xScore) : 0;

    const now = new Date();
    const isRanked = now <= new Date(challenge.grace_deadline_at_utc);

    await supabase.from("game_results").insert({
      attempts: nextAttempts,
      challenge_id: session.challenge_id,
      is_ranked: isRanked,
      player_id: user.id,
      score,
      score_raw: baseScore,
      scoring_version: 1,
      session_id: sessionId,
      status: isCorrect ? "won" : "lost",
      time_seconds: Math.floor(
        (now.getTime() - new Date(session.start_time).getTime()) / 1000,
      ),
    });
    await trackEvent(
      "game_completed",
      {
        attempts: nextAttempts,
        challenge_id: session.challenge_id,
        score,
        status: isCorrect ? "won" : "lost",
      },
      user.id,
    );
    return score;
  })();

  const nextImageUrl = await getImageUrlForStep(sessionId);

  return {
    answerConcentration: isGameOver
      ? getArrayName(answerPerfume.concentrations)
      : undefined,
    answerName: isGameOver ? answerPerfume.name : undefined,
    feedback,
    finalScore: isGameOver ? finalScore : undefined,
    gameStatus: updatedSession.status as "active" | "won" | "lost",
    guessedPerfumeDetails: mapPerfumeDetails(guessedPerfume),
    guessedPerfumers: guessedPerfume.perfumers ?? [],
    hasGuessedNotes:
      (guessedPerfume.top_notes?.length ?? 0) > 0 ||
      (guessedPerfume.middle_notes?.length ?? 0) > 0 ||
      (guessedPerfume.base_notes?.length ?? 0) > 0,
    imageUrl: nextImageUrl,
    newNonce: newNonce,
    result: isCorrect ? "correct" : "incorrect",
    revealState: getRevealPercentages(nextAttempts),
  };
}

/**
 * Perfume concentration data (e.g., Eau de Parfum).
 */
type ConcentrationData = { name: string } | { name: string }[] | null;

/**
 * Returns the concentration name from the given data.
 */
function getArrayName(value: ConcentrationData): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0]?.name;
  return value.name;
}

/**
 * Maps perfume database details to game state format.
 */
function mapPerfumeDetails(perfume: {
  concentrations: ConcentrationData;
  gender?: string | null;
  release_year: number | null;
}) {
  return {
    concentration: getArrayName(perfume.concentrations) ?? "Unknown",
    gender: perfume.gender ?? "Unknown", // Don't default to "Unisex" - Unknown is safer
    year: perfume.release_year ?? 0,
  };
}

/**
 * Records a loss in game_results and fetches the answer perfume name for reveal.
 */
async function recordSkipLoss(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: { challenge_id: string; start_time: string },
  sessionId: string,
  playerId: string,
  attemptCount: number,
): Promise<{ answerConcentration?: string; answerName?: string }> {
  const adminSupabase = createAdminClient();
  const { data: challenge } = await adminSupabase
    .from("daily_challenges")
    .select("perfume_id, grace_deadline_at_utc")
    .eq("id", session.challenge_id)
    .single();

  if (!challenge)
    return { answerConcentration: undefined, answerName: undefined };

  const now = new Date();
  const isRanked = now <= new Date(challenge.grace_deadline_at_utc);
  await supabase.from("game_results").insert({
    attempts: attemptCount,
    challenge_id: session.challenge_id,
    is_ranked: isRanked,
    player_id: playerId,
    score: 0,
    score_raw: 0,
    scoring_version: 1,
    session_id: sessionId,
    status: "lost",
    time_seconds: Math.floor(
      (now.getTime() - new Date(session.start_time).getTime()) / 1000,
    ),
  });

  const { data: answerPerfume } = (await adminSupabase
    .from("perfumes")
    .select("name, concentrations(name)")
    .eq("id", challenge.perfume_id)
    .single()) as {
    data: {
      concentrations: { name: string } | { name: string }[] | null;
      name: string;
    } | null;
  };

  return {
    answerConcentration: answerPerfume
      ? getArrayName(answerPerfume.concentrations)
      : undefined,
    answerName: answerPerfume?.name,
  };
}

/**
 * Pomija aktualną próbę. Zużywa jedną próbę bez podawania perfum.
 * Jeśli to ostatnia próba, kończy grę przegraną.
 */
export async function skipAttempt(
  sessionId: string,
  clientNonce: string,
): Promise<SkipAttemptResult> {
  if (!uuidSchema.safeParse(sessionId).success) {
    throw new Error("Invalid session ID");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("skipAttempt: Unauthorized", { sessionId, userError });
    throw new Error("Unauthorized");
  }

  await checkRateLimit("skipAttempt", user.id);

  const { data: session, error: sessionError } = (await supabase
    .from("game_sessions")
    .select(
      "id, last_nonce, status, attempts_count, challenge_id, player_id, guesses, start_time",
    )
    .eq("id", sessionId)
    .limit(1)
    .single()) as {
    data: {
      attempts_count: number;
      challenge_id: string;
      guesses:
        | {
            isCorrect: boolean;
            isSkip?: boolean;
            perfumeId: string | null;
            timestamp: string;
          }[]
        | null;
      id: string;
      last_nonce: string | number;
      player_id: string;
      start_time: string;
      status: string;
    } | null;
    error: Error | null;
  };

  if (sessionError || !session) throw new Error("Session not found");

  if (String(session.last_nonce) !== clientNonce) {
    throw new Error(`CONFLICT:${session.last_nonce}`);
  }

  if (session.status !== "active") {
    return {
      gameStatus: session.status as "active" | "won" | "lost",
      newNonce: String(session.last_nonce),
    };
  }

  const nextAttempts = session.attempts_count + 1;
  const isGameOver = nextAttempts >= MAX_GUESSES;
  const newNonce = generateNonce();
  const newStatus: "active" | "lost" = isGameOver ? "lost" : "active";

  const skipEntry = {
    isCorrect: false,
    isSkip: true,
    perfumeId: null,
    timestamp: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("game_sessions")
    .update({
      attempts_count: nextAttempts,
      guesses: [...(session.guesses ?? []), skipEntry],
      last_guess: new Date().toISOString(),
      last_nonce: newNonce,
      status: newStatus,
    })
    .eq("id", sessionId)
    .eq("last_nonce", clientNonce);

  if (updateError) throw new Error(`CONFLICT:${session.last_nonce}`);

  await trackEvent(
    "attempt_skipped",
    {
      attempt_number: nextAttempts,
      challenge_id: session.challenge_id,
      session_id: sessionId,
    },
    user.id,
  );

  const { answerConcentration, answerName } = isGameOver
    ? await recordSkipLoss(supabase, session, sessionId, user.id, nextAttempts)
    : { answerConcentration: undefined, answerName: undefined };

  const imageUrl = await getImageUrlForStep(sessionId);

  return {
    answerConcentration,
    answerName,
    gameStatus: newStatus,
    imageUrl,
    newNonce,
  };
}

/**
 * Resetuje grę dla użytkownika i wyzwania.
 */
export async function resetGame(
  sessionId: string,
): Promise<{ error?: string; success: boolean }> {
  // Guard: reset is a dev/debug feature, disabled in production unless explicitly enabled
  if (env.NEXT_PUBLIC_GAME_RESET_ENABLED !== "true") {
    return { error: "Reset disabled", success: false };
  }

  // Validate UUID format for sessionId
  if (!uuidSchema.safeParse(sessionId).success) {
    throw new Error("Invalid session ID");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Authentication is required; getSession() fallback removed per CLAUDE.md
  // getUser() performs proper JWT validation

  if (!user) {
    console.error("resetGame: Unauthorized access", { sessionId, userError });
    throw new Error("Unauthorized");
  }

  const { data: sessionData } = await supabase
    .from("game_sessions")
    .select("challenge_id")
    .eq("id", sessionId)
    .single();

  const targetChallengeId = sessionData
    ? String(sessionData.challenge_id)
    : undefined;
  if (!targetChallengeId) return { success: true };

  await supabase
    .from("game_results")
    .delete()
    .eq("player_id", user.id)
    .eq("challenge_id", targetChallengeId);
  await supabase
    .from("game_sessions")
    .delete()
    .eq("player_id", user.id)
    .eq("challenge_id", targetChallengeId);

  revalidatePath("/");
  return { success: true };
}

/**
 * Pobiera pełne dane dzisiejszego wyzwania bez wymagania auth użytkownika.
 * Używane wyłącznie do SSR w page.tsx (ISR-safe).
 * W razie błędu zwraca null — GameProvider fallback'uje do initializeGame().
 * Wynik jest cachowany przez Next.js na 24h (revalidate: 86_400).
 */
export const getDailyChallengeSSR = unstable_cache(
  async (targetDate: string): Promise<DailyChallenge | null> => {
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from("daily_challenges_public")
      .select(
        "challenge_date, grace_deadline_at_utc, id, mode, snapshot_metadata",
      )
      .eq("challenge_date", targetDate)
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error(
        "[getDailyChallengeSSR] Error fetching public challenge:",
        error,
      );
      return null;
    }

    if (data.id == null) return null;

    const { data: challengePrivate } = await adminSupabase
      .from("daily_challenges")
      .select("perfume_id")
      .eq("id", data.id)
      .single();

    if (!challengePrivate) return null;

    const { data: perfume } = (await adminSupabase
      .from("perfumes")
      .select(
        `
        release_year, gender, is_linear, xsolve_score,
        top_notes, middle_notes, base_notes, perfumers,
        brands (name), concentrations (name)
      `,
      )
      .eq("id", challengePrivate.perfume_id)
      .single()) as {
      data: {
        base_notes: string[] | null;
        brands: { name: string } | null;
        concentrations: { name: string } | null;
        gender: string | null;
        is_linear: boolean | null;
        middle_notes: string[] | null;
        perfumers: string[] | null;
        release_year: number | null;
        top_notes: string[] | null;
        xsolve_score: number | null;
      } | null;
    };

    if (perfume?.xsolve_score == null) return null;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- same pattern as getDailyChallenge: view returns nullable fields validated above
    return {
      ...data,
      clues: {
        brand: perfume.brands?.name ?? "Unknown",
        concentration: perfume.concentrations?.name ?? "Unknown",
        gender: perfume.gender || "Unknown",
        isLinear: perfume.is_linear ?? false,
        notes: {
          base: perfume.base_notes ?? [],
          heart: perfume.middle_notes ?? [],
          top: perfume.top_notes ?? [],
        },
        perfumer:
          perfume.perfumers && perfume.perfumers.length > 0
            ? perfume.perfumers.join(", ")
            : "Unknown",
        xsolve: perfume.xsolve_score,
        year: perfume.release_year ?? 0,
      },
    } as DailyChallenge;
  },
  ["daily-challenge-ssr"],
  { revalidate: 86_400, tags: ["daily-challenge"] },
);

/**
 * Pobiera URL obrazka step-1 dzisiejszego wyzwania bez wymagania auth.
 * Używane wyłącznie do SSR preload w page.tsx (ISR-safe).
 * W razie błędu zwraca null — GameProvider fallback'uje do /placeholder.svg.
 * Wynik jest cachowany przez Next.js na 24h (revalidate: 86_400).
 */
export const getDailyStep1ImageUrl = unstable_cache(
  async (targetDate: string): Promise<string | null> => {
    try {
      const adminSupabase = createAdminClient();

      const { data: challenge } = await adminSupabase
        .from("daily_challenges")
        .select("perfume_id")
        .eq("challenge_date", targetDate)
        .limit(1)
        .single();

      if (!challenge) return null;

      const { data: assets } = await adminSupabase
        .from("perfume_assets")
        .select("image_key_step_1")
        .eq("perfume_id", challenge.perfume_id)
        .single();

      if (!assets?.image_key_step_1) return null;

      const assetsHost = env.NEXT_PUBLIC_ASSETS_HOST ?? "assets.eauxle.com";
      return `https://${assetsHost}/${assets.image_key_step_1}`;
    } catch {
      return null; // graceful fallback
    }
  },
  ["daily-step1-image"],
  { revalidate: 86_400, tags: ["daily-challenge"] },
);

/**
 * Fetches the player's existing game session for today's challenge at SSR time.
 *
 * Security model:
 * - Uses createClient() which reads auth cookies from the incoming request —
 *   only the authenticated user's own sessions are accessible (Supabase RLS).
 * - Does NOT expose answer data (name/concentration) unless game is already over.
 * - Returns null for unauthenticated users — GameProvider falls back to
 *   client-side anonymous auth + startGame as before.
 * - On any error returns null — graceful degradation, never crashes SSR.
 *
 * Performance:
 * - Delegates to startGame() which short-circuits on existingSession (no rate-limit,
 *   no new DB insert). For a returning player this is a single SELECT query.
 * - Not cached — per-user per-request by design.
 */
export async function getPlayerDailySession(
  challengeId: string,
): Promise<StartGameResponse | null> {
  z.uuid().parse(challengeId);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Not authenticated — client-side anonymous auth flow will handle this
    if (!user) return null;

    // Fetch or create session (startGame handles both paths)
    // For existing sessions it returns immediately without creating a new one
    return await startGame(challengeId, 0);
  } catch {
    // Graceful degradation: if anything fails, GameProvider falls back to client-side init
    return null;
  }
}

/**
 * Gate 6 — Lazy init: atomically creates a game session and submits the first guess.
 * Called when the user makes their first guess before a session exists (deferred startGame).
 * Combines startGame + submitGuess into a single server roundtrip.
 */
export async function initializeAndGuess(
  challengeId: string,
  perfumeId: string,
  inheritedCount: number,
): Promise<{
  guessResult: SubmitGuessResult;
  imageUrl: string | null;
  nonce: string;
  sessionId: string;
}> {
  const validatedChallengeId = uuidSchema.parse(challengeId);
  const validatedPerfumeId = uuidSchema.parse(perfumeId);
  const validatedInheritedCount = z.number().int().min(0).parse(inheritedCount);
  const session = await startGame(validatedChallengeId, validatedInheritedCount);
  const guessResult = await submitGuess(session.sessionId, validatedPerfumeId, session.nonce);
  return {
    guessResult,
    imageUrl: guessResult.imageUrl ?? session.imageUrl ?? null,
    nonce: guessResult.newNonce,
    sessionId: session.sessionId,
  };
}

/**
 * Gate 6 — Lazy init: atomically creates a game session and skips the first attempt.
 * Called when the user skips before a session exists (deferred startGame).
 * Combines startGame + skipAttempt into a single server roundtrip.
 */
export async function initializeAndSkip(
  challengeId: string,
  inheritedCount: number,
): Promise<{
  imageUrl: string | null;
  nonce: string;
  sessionId: string;
  skipResult: SkipAttemptResult;
}> {
  const validatedChallengeId = uuidSchema.parse(challengeId);
  const validatedInheritedCount = z.number().int().min(0).parse(inheritedCount);
  const session = await startGame(validatedChallengeId, validatedInheritedCount);
  const skipResult = await skipAttempt(session.sessionId, session.nonce);
  return {
    imageUrl: skipResult.imageUrl ?? session.imageUrl ?? null,
    nonce: skipResult.newNonce,
    sessionId: session.sessionId,
    skipResult,
  };
}
