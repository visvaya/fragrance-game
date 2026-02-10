"use server";

import { revalidatePath } from "next/cache";

import { trackEvent, identifyUser } from "@/lib/analytics-server";
import { MAX_GUESSES } from "@/lib/constants";
import {
  calculateBaseScore,
  calculateFinalScore,
  getRevealPercentages,
  type RevealState,
} from "@/lib/game/scoring";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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

export type GuessHistoryItem = {
  brandName: string;
  concentration?: string;
  feedback?: AttemptFeedback;
  gender?: string;
  isCorrect: boolean;
  perfumeId: string;
  perfumeName: string;
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

export type InitializeGameResponse = {
  challenge: DailyChallenge | null;
  session: StartGameResponse | null;
};

export type AttemptFeedback = {
  brandMatch: boolean;
  notesMatch: number; // 0-1 matches
  perfumerMatch: "full" | "partial" | "none";
  yearDirection: "higher" | "lower" | "equal";
  yearMatch: "correct" | "close" | "wrong";
};

export type GuessResult = {
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
  imageUrl?: string | null;
  message?: string;
  newNonce: string;
  result: "correct" | "incorrect";
  revealState: RevealState;
};

// --- Helpers ---

/**
 * Normalizuje nazwę nuty zapachowej do porównań. Usuwa znaki towarowe i zbędne określenia.
 */
function cleanNote(note: string | null | undefined): string {
  if (typeof note !== "string") return "";
  let t = note.trim();
  t = t.replaceAll(/[™®]/g, "");
  t = t.replaceAll(/\bLa Réunion\b/gi, "");
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
  const pattern = new RegExp(String.raw`\b(${removeWords.join("|")})\b`, "gi");
  t = t.replaceAll(pattern, "");
  t = t.replaceAll(/\(.*?\)/g, "");
  t = t.replaceAll(/\s+/g, " ").trim();
  t = t.replace(/[,-]$/, "").trim();
  return t.toLowerCase();
}

/**
 * Oblicza podobieństwo Jaccarda między nutami zgadniętymi a poprawnymi.
 */
function calculateNotesMatch(
  guessNotes: { base: string[]; heart: string[]; top: string[]; },
  answerNotes: { base: string[]; heart: string[]; top: string[]; },
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

  let matchCount = 0;
  for (const p of guessSet) {
    if (answerSet.has(p)) matchCount++;
  }

  if (matchCount === answerSet.size && guessSet.size === answerSet.size)
    return "full";
  if (matchCount > 0) return "partial";
  return "none";
}

/**
 * Generuje bezpieczny kryptograficznie nonce (BigInt jako string).
 */
function generateNonce(): string {
  const array = new BigInt64Array(1);
  crypto.getRandomValues(array);
  return array[0].toString();
}

// --- Actions ---

/**
 * Pobiera dane codziennego wyzwania (widok publiczny + detale od admina).
 */
export async function getDailyChallenge(): Promise<DailyChallenge | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("daily_challenges_public")
    .select("challenge_date, grace_deadline_at_utc, id, mode, snapshot_metadata")
    .eq("challenge_date", new Date().toISOString().split("T")[0])
    .limit(1)
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") return null;
    console.error("Error fetching daily challenge:", error);
    throw new Error("Failed to fetch daily challenge");
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

  const brandName = (perfume.brands as { name: string } | null)?.name ?? "Unknown";
  const concentrationName = (perfume.concentrations as { name: string } | null)?.name ?? "Unknown";

  return {
    ...data,
    clues: {
      brand: brandName,
      concentration: concentrationName,
      gender: perfume.gender ?? "Unisex",
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
      xsolve: perfume.xsolve_score ?? 0,
      year: perfume.release_year ?? 0,
    },
  } as DailyChallenge;
}

/**
 * Rozpoczyna nową sesję gry lub wznawia istniejącą.
 */
export async function startGame(
  challengeId: string,
): Promise<StartGameResponse> {
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const user = data?.user;

  if (userError || !user) {
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
        guesses: {
          feedback?: AttemptFeedback;
          isCorrect: boolean;
          perfumeId: string;
          timestamp: string;
        }[] | null;
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
    const enrichedGuesses: GuessHistoryItem[] = [];

    if (rawGuesses.length > 0) {
      const adminSupabase = createAdminClient();
      const perfumeIds = rawGuesses.map((g) => g.perfumeId);

      const { data: perfumes } = (await adminSupabase
        .from("perfumes")
        .select(
          "id, name, brands(name), release_year, concentrations(name), gender",
        )
        .in("id", perfumeIds)) as {
          data: {
            brands: { name: string } | null;
            concentrations: { name: string } | null;
            gender: string | null;
            id: string;
            name: string;
            release_year: number | null;
          }[] | null;
        };

      if (perfumes && perfumes.length > 0) {
        const perfumeMap = new Map(perfumes.map((p) => [p.id, p]));

        for (const guess of rawGuesses) {
          const p = perfumeMap.get(guess.perfumeId);
          if (p) {
            enrichedGuesses.push({
              brandName: (p.brands as { name: string } | null)?.name ?? "Unknown",
              concentration: (p.concentrations as { name: string } | null)?.name,
              feedback: guess.feedback,
              gender: p.gender ?? undefined,
              isCorrect: guess.isCorrect,
              perfumeId: guess.perfumeId,
              perfumeName: p.name,
              timestamp: guess.timestamp,
              year: p.release_year ?? undefined,
            });
          }
        }
      }
    }

    let answerName: string | undefined;
    let answerConcentration: string | undefined;
    if (existingSession.status === "won" || existingSession.status === "lost") {
      const adminSupabase = createAdminClient();
      const { data: challenge } = await adminSupabase
        .from("daily_challenges")
        .select("perfume_id")
        .eq("id", challengeId)
        .single();

      if (challenge) {
        const { data: p } = (await adminSupabase
          .from("perfumes")
          .select("name, concentrations(name)")
          .eq("id", challenge.perfume_id)
          .single()) as {
            data: { concentrations: { name: string } | null; name: string; } | null;
          };

        if (p) {
          answerName = p.name;
          answerConcentration = (p.concentrations as { name: string } | null)?.name;
        }
      }
    }

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

  const nonce = generateNonce();
  const { data: session, error: insertError } = (await supabase
    .from("game_sessions")
    .insert({
      attempts_count: 0,
      challenge_id: challengeId,
      guesses: [],
      last_guess: null,
      last_nonce: nonce,
      player_id: user.id,
      start_time: new Date().toISOString(),
      status: "active",
    })
    .select("attempts_count, challenge_id, id, last_nonce, player_id, start_time, status")
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
    .single()) as { data: { mode: string; grace_deadline_at_utc: string } | null };

  await identifyUser(user.id);
  await trackEvent(
    "game_started",
    {
      challenge_id: challengeId,
      mode: (challengeData as { mode: string } | null)?.mode ?? "daily",
      session_id: session.id,
    },
    user.id,
  );

  return {
    graceDeadline: challengeData?.grace_deadline_at_utc ?? "",
    guesses: [],
    imageUrl: imageUrl,
    nonce: nonce,
    revealState: getRevealPercentages(1),
    sessionId: session.id,
  };
}

/**
 * Inicjalizuje grę, pobierając wyzwanie i rozpoczynając sesję.
 */
export async function initializeGame(): Promise<InitializeGameResponse> {
  let challenge: DailyChallenge | null = null;
  try {
    challenge = await getDailyChallenge();
    if (!challenge) return { challenge: null, session: null };

    const session = await startGame(challenge.id);
    return { challenge, session };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized" && challenge) {
      console.warn("initializeGame: Unauthorized, returning challenge only.");
      return { challenge, session: null };
    }
    console.error("Error in initializeGame:", error);
    return { challenge: null, session: null };
  }
}

/**
 * Pobiera URL obrazka dla danego etapu gry.
 */
export async function getImageUrlForStep(sessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) throw new Error("Unauthorized");

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
  const step = isRevealed ? 6 : Math.min(session.attempts_count + 1, MAX_GUESSES);
  const key = (assets as Record<string, string>)[`image_key_step_${step}`];

  const assetsHost = process.env.NEXT_PUBLIC_ASSETS_HOST ?? "assets.eauxle.com";
  if (!assetsHost && process.env.NODE_ENV === "production") {
    throw new Error("Missing NEXT_PUBLIC_ASSETS_HOST");
  }
  return `https://${assetsHost}/${key}`;
}

/**
 * Wysyła zgadnięcie użytkownika i aktualizuje stan gry.
 */
export async function submitGuess(
  sessionId: string,
  perfumeId: string,
  clientNonce: string,
): Promise<GuessResult> {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) throw new Error("Unauthorized");

  const { data: session, error: sessionError } = (await supabase
    .from("game_sessions")
    .select("id, last_nonce, status, attempts_count, challenge_id, player_id, guesses, start_time")
    .eq("id", sessionId)
    .limit(1)
    .single()) as {
      data: {
        attempts_count: number;
        challenge_id: string;
        guesses: {
          feedback?: AttemptFeedback;
          isCorrect: boolean;
          perfumeId: string;
          timestamp: string;
        }[] | null;
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
      gameStatus: session.status as "active" | "won" | "lost",
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
  const isGameOver = isCorrect || nextAttempts >= 6;

  type PerfumeData = {
    base_notes: string[] | null;
    brand_id: string;
    concentration_id?: string;
    concentrations: { name: string } | { name: string }[] | null;
    gender?: string | null;
    middle_notes: string[] | null;
    name?: string;
    perfumers: { name: string }[] | null;
    release_year: number | null;
    top_notes: string[] | null;
  };

  const [guessedPerfumeRes, answerPerfumeRes] = (await Promise.all([
    adminSupabase
      .from("perfumes")
      .select("brand_id, release_year, top_notes, middle_notes, base_notes, perfumers, concentration_id, concentrations(name), gender")
      .eq("id", perfumeId)
      .limit(1)
      .single(),
    adminSupabase
      .from("perfumes")
      .select("name, brand_id, release_year, top_notes, middle_notes, base_notes, perfumers, concentrations(name)")
      .eq("id", challenge.perfume_id)
      .limit(1)
      .single(),
  ])) as [
      { data: PerfumeData | null; error: Error | null; },
      { data: PerfumeData | null; error: Error | null; },
    ];

  const guessedPerfumeResult = guessedPerfumeRes;
  const answerPerfumeResult = answerPerfumeRes;

  const guessedPerfume = guessedPerfumeResult.data;
  const answerPerfume = answerPerfumeResult.data;

  if (!guessedPerfume || !answerPerfume) {
    throw new Error("Perfume data missing");
  }

  const yearDiff = (guessedPerfume.release_year ?? 0) - (answerPerfume.release_year ?? 0);
  let yearMatch: "correct" | "close" | "wrong" = "wrong";
  if (yearDiff === 0) yearMatch = "correct";
  else if (Math.abs(yearDiff) <= 3) yearMatch = "close";

  const feedback: AttemptFeedback = {
    brandMatch: guessedPerfume.brand_id === answerPerfume.brand_id,
    notesMatch: calculateNotesMatch(
      { base: guessedPerfume.base_notes ?? [], heart: guessedPerfume.middle_notes ?? [], top: guessedPerfume.top_notes ?? [] },
      { base: answerPerfume.base_notes ?? [], heart: answerPerfume.middle_notes ?? [], top: answerPerfume.top_notes ?? [] },
    ),
    perfumerMatch: calculatePerfumerMatch(
      guessedPerfume.perfumers?.map((p) => p.name) ?? null,
      answerPerfume.perfumers?.map((p) => p.name) ?? null,
    ),
    yearDirection: yearDiff > 0 ? "lower" : yearDiff < 0 ? "higher" : "equal",
    yearMatch: yearMatch,
  };

  const newNonce = generateNonce();
  const guessEntry = {
    feedback,
    isCorrect,
    perfumeId,
    timestamp: new Date().toISOString(),
  };

  const { data: updatedSession, error: updateError } = await supabase
    .from("game_sessions")
    .update({
      attempts_count: nextAttempts,
      guesses: [...((session?.guesses ?? []) as unknown as AttemptFeedback[]), guessEntry],
      last_guess: new Date().toISOString(),
      last_nonce: newNonce,
      status: isGameOver ? (isCorrect ? "won" : "lost") : "active",
    })
    .eq("id", sessionId)
    .eq("last_nonce", clientNonce)
    .select("attempts_count, challenge_id, guesses, id, last_guess, last_nonce, player_id, start_time, status")
    .limit(1)
    .single();

  if (updateError || !updatedSession) {
    throw new Error(`CONFLICT:${session.last_nonce}`);
  }

  await trackEvent("guess_submitted", {
    attempt_number: nextAttempts,
    challenge_id: session.challenge_id,
    is_correct: isCorrect,
    perfume_id: perfumeId,
    session_id: sessionId,
  }, user.id);

  let finalScore = 0;
  if (isGameOver) {
    const { data: targetPerfume } = (await adminSupabase
      .from("perfumes")
      .select("xsolve_score")
      .eq("id", challenge.perfume_id)
      .single()) as { data: { xsolve_score: number } | null };

    const xScore = targetPerfume?.xsolve_score ?? 0;
    const baseScore = isCorrect ? calculateBaseScore(nextAttempts) : 0;
    finalScore = isCorrect ? calculateFinalScore(baseScore, xScore) : 0;

    const now = new Date();
    const isRanked = now <= new Date(challenge.grace_deadline_at_utc);

    await supabase.from("game_results").insert({
      attempts: nextAttempts,
      challenge_id: session.challenge_id,
      is_ranked: isRanked,
      player_id: user.id,
      score: finalScore,
      score_raw: baseScore,
      scoring_version: 1,
      session_id: sessionId,
      status: isCorrect ? "won" : "lost",
      time_seconds: Math.floor((now.getTime() - new Date(session.start_time).getTime()) / 1000),
    });
    await trackEvent("game_completed", {
      attempts: nextAttempts,
      challenge_id: session.challenge_id,
      score: finalScore,
      status: isCorrect ? "won" : "lost",
    }, user.id);
  }

  const nextImageUrl = await getImageUrlForStep(sessionId);

  return {
    answerConcentration: isGameOver ? getArrayName(answerPerfume.concentrations) : undefined,
    answerName: isGameOver ? answerPerfume.name : undefined,
    feedback,
    finalScore: isGameOver ? finalScore : undefined,
    gameStatus: updatedSession.status as "active" | "won" | "lost",
    guessedPerfumeDetails: mapPerfumeDetails(guessedPerfume),
    guessedPerfumers: guessedPerfume.perfumers?.map((p) => p.name) ?? [],
    imageUrl: nextImageUrl,
    newNonce: newNonce,
    result: isCorrect ? "correct" : "incorrect",
    revealState: getRevealPercentages(nextAttempts),
  };
}

function getArrayName(value: { name: string } | { name: string }[] | null): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0]?.name;
  return value.name;
}

function mapPerfumeDetails(perfume: { concentrations: { name: string } | { name: string }[] | null; gender?: string | null; release_year: number | null; }) {
  return {
    concentration: getArrayName(perfume.concentrations) ?? "Unknown",
    gender: perfume.gender ?? "Unisex",
    year: perfume.release_year ?? 0,
  };
}


/**
 * Resetuje grę dla użytkownika i wyzwania.
 */
export async function resetGame(sessionId: string): Promise<{ error?: string; success: boolean; }> {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) throw new Error("Unauthorized");

  const { data: sessionData } = await supabase
    .from("game_sessions")
    .select("challenge_id")
    .eq("id", sessionId)
    .single();

  const targetChallengeId = sessionData?.challenge_id;
  if (!targetChallengeId) return { success: true };

  await supabase.from("game_results").delete().eq("player_id", user.id).eq("challenge_id", targetChallengeId);
  await supabase.from("game_sessions").delete().eq("player_id", user.id).eq("challenge_id", targetChallengeId);

  revalidatePath("/");
  return { success: true };
}
