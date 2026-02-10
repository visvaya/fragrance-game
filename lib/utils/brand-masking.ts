import { revealLetters } from "@/lib/game/scoring";

/**
 * Masks the brand name progressively based on the number of attempts.
 * Uses "Center-Out" reveal strategy (Right-Center -> Ends).
 *
 * Logic matches GameProvider:
 * | attempts_count | Brand Reveal | Percentage |
 * |----------------|--------------|------------|
 * | 1              | •••          | -          |
 * | 2              | 0%           | 0.0        |
 * | 3              | 15%          | 0.15       |
 * | 4              | 40%          | 0.40       |
 * | 5              | 70%          | 0.70       |
 * | 6              | 100%         | 1.0        |
 * @param brand
 * @param attemptsCount
 */
export function maskBrand(brand: string, attemptsCount: number): string {
  // attemptsCount is essentially currentAttempt (1-based)
  // If attemptsCount <= 1, return generic placeholder
  if (attemptsCount <= 1) return "•••";

  const revealPercentages: Record<number, number> = {
    2: 0,
    3: 0.15,
    4: 0.4,
    5: 0.7,
    6: 1,
  };

  const revealPercent = revealPercentages[Math.min(attemptsCount, 6)] ?? 0;

  return revealLetters(brand, revealPercent);
}

/**
 * Masks the release year progressively.
 * Logic matches GameProvider:
 * | attempts_count | Year Reveal | Example (1979) |
 * |----------------|-------------|----------------|
 * | 1              | ••••        | ••••           |
 * | 2              | 1st digit   | 1•••           |
 * | 3              | 2 digits    | 19••           |
 * | 4              | 3 digits    | 197•           |
 * | 5+             | Full        | 1979           |
 * @param year
 * @param attemptsCount
 */
export function maskYear(
  year: number | null,
  attemptsCount: number,
): string | null {
  if (!year) return null;

  // attemptsCount corresponds to revealLevel
  // Level 1: ••••
  // Level 2: 1•••
  // Level 3: 19••
  // Level 4: 197•
  // Level 5: 1979

  const safeAttempts = Math.min(attemptsCount, 6);
  const yearString = year.toString();

  if (safeAttempts >= 5) return yearString;
  if (safeAttempts === 4) return yearString.slice(0, 3) + "_";
  if (safeAttempts === 3) return yearString.slice(0, 2) + "__";
  if (safeAttempts === 2) return yearString.slice(0, 1) + "___";

  return "____";
}
