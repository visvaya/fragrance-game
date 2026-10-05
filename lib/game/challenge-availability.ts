/**
 * Returns the UTC calendar date of `now` as `YYYY-MM-DD`, the format of
 * `daily_challenges.challenge_date`. A daily challenge belongs to a UTC day.
 * @param now - The moment to convert.
 * @returns The UTC date string.
 */
export function toUtcDateString(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Tells whether a challenge may be started at `now`: its UTC day has begun.
 * Challenges are created ahead of their day, so a later date is not playable yet.
 * @param challengeDate - The challenge's `challenge_date` (`YYYY-MM-DD`).
 * @param now - The current moment.
 * @returns `true` for today's or an earlier challenge, `false` for a future one.
 */
export function isChallengeAvailable(
  challengeDate: string,
  now: Date,
): boolean {
  return challengeDate <= toUtcDateString(now);
}

/**
 * Tells whether a finished game counts as ranked. The rule looks at when the
 * session started, not when the game ended: a game started before the end of the
 * puzzle's UTC day stays ranked even if it ends after midnight, while a session
 * started after that deadline (archive play of a past puzzle) is not ranked. Daily
 * streaks follow the same rule.
 * @param sessionStart - When the game session was created (`start_time`).
 * @param graceDeadline - The challenge's `grace_deadline_at_utc`.
 * @returns `true` when the session started at or before the deadline; `false`
 * otherwise or when either date is invalid.
 */
export function isRankedStart(
  sessionStart: Date,
  graceDeadline: Date,
): boolean {
  const start = sessionStart.getTime();
  const deadline = graceDeadline.getTime();
  if (Number.isNaN(start) || Number.isNaN(deadline)) return false;
  return start <= deadline;
}
