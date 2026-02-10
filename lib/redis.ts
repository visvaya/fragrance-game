import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export const limiters = {
  // 60 requests per minute per user
  autocomplete: new Ratelimit({
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:autocomplete",
    redis,
  }),
  // 30 requests per minute per user (game loading/refreshing)
  getDailyChallenge: new Ratelimit({
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:getDailyChallenge",
    redis,
  }),
  // 5 requests per minute per user (prevent session spam)
  startGame: new Ratelimit({
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "ratelimit:startGame",
    redis,
  }),
  // 10 requests per minute per user (anti-brute-force for guesses)
  submitGuess: new Ratelimit({
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "ratelimit:submitGuess",
    redis,
  }),
};

/**
 * Checks the rate limit for a specific action and user.
 * Throws an error if the limit is exceeded.
 * @param action
 * @param userId
 */
export async function checkRateLimit(
  action: keyof typeof limiters,
  userId: string,
): Promise<void> {
  const { success } = await limiters[action].limit(userId);

  if (!success) {
    throw new Error(
      `Rate limit exceeded for ${action}. Please try again later.`,
    );
  }
}
