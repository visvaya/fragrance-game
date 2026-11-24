import { MASK_CHAR, MAX_GUESSES } from "@/lib/constants";

/**
 * Scoring and Reveal Logic for Fragrance Game
 */

// Points per attempt (1st attempt = 1000, 6th = 168)
// Formula: 1000 * (0.7 ^ (attempt - 1))
const ATTEMPT_SCORES: Record<number, number> = {
  1: 1000,
  2: 700,
  3: 490,
  4: 343,
  5: 240,
  6: 168,
};

/**
 * Calculates raw score based on attempt number.
 * @param attempt
 */
export function calculateBaseScore(attempt: number): number {
  // If somehow out of bounds, clamp
  if (attempt < 1) return 1000;
  if (attempt > MAX_GUESSES) return 0;
  return ATTEMPT_SCORES[attempt] ?? 0;
}

/**
 * Calculates final score including difficulty multiplier (xSolve).
 * precision: 0 decimal places.
 * @param baseScore
 * @param xSolve
 */
export function calculateFinalScore(baseScore: number, xSolve: number): number {
  // xSolve bonus: +30% for max difficulty (xSolve=1.0)
  // Formula: baseScore * (1 + (xSolve * 0.3))
  const multiplier = 1 + xSolve * 0.3;
  return Math.round(baseScore * multiplier);
}

/**
 * Progressively reveals letters in a string from center outward PER WORD
 * @param text - Text to reveal
 * @param percentage - 0-1 matches 0-100%
 * @returns Masked string preserving separators (spaces only)
 */
export function revealLetters(text: string, percentage: number): string {
  // Handle floating point percentage (0.15 vs 15) if needed, based on usage in game-provider
  // Plan uses 0-100 logic (percentage >= 100).
  // GameProvider uses [0, 0.15...] (0-1).
  // Let's normalize. If percentage <= 1, assume it's float (unless 1=1%).
  // Standardize on 0-100 internally or handle input.
  // Plan passed "percentage" to Math.round(length * (percentage/100)).
  // So Plan expects 0-100.
  // GameProvider passes floats 0.15.
  // Let's adjust inputs:
  const pct = percentage <= 1 ? percentage * 100 : percentage;

  if (!text) return "";
  if (pct >= 100) return text;

  // Separator: ONLY space (always visible, splits words)
  // Letters: ALL other characters including hyphen, period, ampersand, apostrof (masked as MASK_CHAR)
  const SEPARATOR_REGEX = /(\s+)/;

  // Split into words by space only (capturing separators)
  const tokens = text.split(SEPARATOR_REGEX);

  const revealedTokens = tokens.map((token) => {
    // If token is just whitespace, return as is
    if (/^\s+$/.test(token)) return token;

    // Mask entire word at 0%
    if (pct === 0) return MASK_CHAR.repeat(token.length);

    // eslint-disable-next-line unicorn/prefer-spread -- Array.from required; spread operator on string violates @typescript-eslint/no-misused-spread
    const chars = Array.from(token);
    const lettersToReveal = Math.max(1, Math.round(chars.length * (pct / 100)));

    if (lettersToReveal >= chars.length) return token;

    const order = generateSmartRevealOrder(chars.length);
    const revealed = new Set(order.slice(0, lettersToReveal));

    return chars.map((c, i) => (revealed.has(i) ? c : MASK_CHAR)).join("");
  });

  return revealedTokens.join("");
}

function generateSmartRevealOrder(length: number): number[] {
  if (length <= 1) return [0];

  // Sub-range to reveal first: indices 1 to length-1 (skipping the first capital letter)
  const subLength = length - 1;
  const subStart = 1;

  // Calculate center of the sub-range
  // e.g. Length 4 (Dior), sub is indices 1,2,3. Center of 3 items is index 1 (relative) -> 1+1=2 (absolute) -> 'o'
  // e.g. Length 6 (Chanel), sub is 1,2,3,4,5. Center of 5 is index 2 (relative) -> 2+1=3 (absolute) -> 'n'
  const centerRelative = Math.floor((subLength - 1) / 2);
  const centerAbsolute = subStart + centerRelative;

  const order: number[] = [centerAbsolute];

  let left = centerAbsolute - 1;
  let right = centerAbsolute + 1;

  // Expand outwards within the sub-range
  while (left >= subStart || right < length) {
    // Preference: "middle -> towards end" implies prioritizing right side slightly?
    // Example Dior: __o_ (2) -> _io_ (2,1) -> _ior (2,1,3).
    // Let's stick to standard alternating expansion but confined to sub-range.
    // To match user example _io_ (Left neighbor first?), we should prioritize Left if distances are equal?
    // Example: 3 (15%) -> _ (index 2 'o').
    // 4 (40% of 4 = 1.6 -> 2 chars) -> indices 2 and... 1('i'). So Left was picked.
    // 5 (70% of 4 = 2.8 -> 3 chars) -> indices 2, 1, and 3('r'). Right was picked.
    // So strategy: Center, Left, Right, Left, Right...

    if (left >= subStart) {
      // eslint-disable-next-line fp/no-mutating-methods -- imperative alternating-expansion algorithm; functional equivalent would be unreadable
      order.push(left);
      // eslint-disable-next-line fp/no-mutation -- local loop variable for alternating-expansion algorithm
      left -= 1;
    }
    if (right < length) {
      // eslint-disable-next-line fp/no-mutating-methods -- imperative alternating-expansion algorithm; functional equivalent would be unreadable
      order.push(right);
      // eslint-disable-next-line fp/no-mutation -- local loop variable for alternating-expansion algorithm
      right += 1;
    }
  }

  // Finally, reveal the first letter (Brand Capital)
  const finalOrder = [...order, 0];

  return finalOrder;
}
