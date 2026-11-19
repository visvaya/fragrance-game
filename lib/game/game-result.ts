import { rankingForResult } from "@/lib/game/ranking";

import type { GameResultValues } from "@/lib/game/session-writes";

/**
 * The stored result of a finished game: ranking by the grace deadline, play time from the
 * session start to `now` in whole seconds, and scoring version 1.
 */
export function gameResultValues({
  attempts,
  challengeId,
  graceDeadline,
  metadata,
  now,
  score,
  scoreRaw,
  sessionId,
  startTime,
  status,
}: {
  attempts: number;
  challengeId: string;
  graceDeadline: string;
  metadata: unknown;
  now: Date;
  score: number;
  scoreRaw: number;
  sessionId: string;
  startTime: string;
  status: "won" | "lost";
}): GameResultValues {
  return {
    ...rankingForResult({ graceDeadline, metadata, now }),
    attempts,
    challenge_id: challengeId,
    score,
    score_raw: scoreRaw,
    scoring_version: 1,
    session_id: sessionId,
    status,
    time_seconds: Math.floor(
      (now.getTime() - new Date(startTime).getTime()) / 1000,
    ),
  };
}
