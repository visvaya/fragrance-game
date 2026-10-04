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
