import { z } from "zod";

/** What a daily challenge stores about its answer when it is published (`snapshot_metadata`). */
const challengeSnapshotSchema = z.object({ xsolve: z.number() });

/** The `snapshot_metadata` the generate-daily cron writes. */
export type ChallengeSnapshot = z.infer<typeof challengeSnapshotSchema>;

/**
 * Difficulty score a challenge is scored with: the one stored when it was published, so a later
 * catalogue import cannot rescore past puzzles. Challenges published before the snapshot existed
 * (empty or unreadable snapshot) fall back to the perfume's current score.
 * @param snapshot - `snapshot_metadata` of the challenge, as read from the database.
 * @param liveXsolve - Current `xsolve_score` of the answer perfume.
 */
export function challengeXsolve(
  snapshot: unknown,
  liveXsolve: number | null,
): number | null {
  const parsed = challengeSnapshotSchema.safeParse(snapshot);
  return parsed.success ? parsed.data.xsolve : liveXsolve;
}
