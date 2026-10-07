import "server-only";

/** Reason stored on a result whose game began before the player signed in. */
export const STARTED_AS_GUEST = "started_as_guest";

/** Ranking fields of a game result. */
export type ResultRanking = { is_ranked: boolean; ranked_reason?: string };

/** True only for a JSON object whose `started_as_guest` is the boolean `true`. */
const startedAsGuest = (metadata: unknown): boolean =>
  typeof metadata === "object" &&
  metadata !== null &&
  !Array.isArray(metadata) &&
  (metadata as Record<string, unknown>).started_as_guest === true;

/**
 * Decides whether a finished game counts for the ranking. A game moved from a guest
 * (session metadata `started_as_guest: true`) never counts, because its clues were seen
 * before the account existed; any other game counts when finished by the grace deadline.
 */
export function rankingForResult({
  graceDeadline,
  metadata,
  now,
}: {
  graceDeadline: string;
  metadata: unknown;
  now: Date;
}): ResultRanking {
  if (startedAsGuest(metadata)) {
    return { is_ranked: false, ranked_reason: STARTED_AS_GUEST };
  }
  return { is_ranked: now <= new Date(graceDeadline) };
}
