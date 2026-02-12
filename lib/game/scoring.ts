import { MAX_GUESSES } from "@/lib/constants";

/**
 * Scoring and Reveal Logic for Fragrance Game
 */

export type RevealState = {
  blur: number; // Blur radius in px
  brandLetters: number; // Percentage (0-100) of brand letters revealed
  grain: number; // Grain amount (0-100? or arbitrary scale)
  notes: number; // Level of notes revealed (0=None, 1=Top, 2=Middle, 3=Base)
  perfumerLetters: number; // Percentage (0-100) of perfumer letters revealed
  radialMask: number; // Percentage (0-100)
  showGender: boolean;
  yearMask: string; // '----' or full year
};

export type GameStatus = "playing" | "won" | "lost";

export type GameResult = {
  attempts: number; // Number of attempts used (1-6)
  history: string[]; // Array of guessed IDs
  score: number; // Final calculated score
  timeTaken: number; // Seconds from start
};

// Points per attempt (1st attempt = 1000, 6th = 168)
// Formula: 1000 * (0.7 ^ (attempt - 1))
export const ATTEMPT_SCORES: Record<number, number> = {
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
  return ATTEMPT_SCORES[attempt] || 0;
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
 * Returns the visual reveal state for a given attempt number (1-6).
 * @param attempt
 */
export function getRevealPercentages(attempt: number): RevealState {
  // Ensure attempt is clamped 1-6
  const safeAttempt = Math.max(1, Math.min(MAX_GUESSES, attempt));

  switch (safeAttempt) {
    case 1: {
      // Attempt 1: 0% radial, 10px blur, 3% grain. 0% letters. Year ____. Notes: None (User said ___x3, implying hidden)
      return {
        blur: 10,
        brandLetters: 0,
        grain: 3,
        notes: 0,
        perfumerLetters: 0,
        radialMask: 0,
        showGender: false,
        yearMask: "____",
      };
    }
    case 2: {
      // Attempt 2: 5% radial, 9.5px blur, 2.5% grain. 0% letters. Year 1___. Notes: None? User said "_ (jak w marce)" which usually means 0% or hidden.
      return {
        blur: 9.5,
        brandLetters: 0,
        grain: 2.5,
        notes: 0,
        perfumerLetters: 0,
        radialMask: 5,
        showGender: false,
        yearMask: "1___",
      };
    }
    case 3: {
      // Attempt 3: 8% radial, 8.5px blur, 2% grain. 15% Brand, 10% Perfumer. Notes: Top (Level 1). Year 19__.
      return {
        blur: 8.5,
        brandLetters: 15,
        grain: 2,
        notes: 1,
        perfumerLetters: 10,
        radialMask: 8,
        showGender: false,
        yearMask: "19__",
      };
    }
    case 4: {
      // Attempt 4: 11% radial, 7.5px blur, 1.8% grain. 40% Brand, 30% Perfumer. Notes: +Middle (Level 2). Year 197_.
      return {
        blur: 7.5,
        brandLetters: 40,
        grain: 1.8,
        notes: 2,
        perfumerLetters: 30,
        radialMask: 11,
        showGender: false,
        yearMask: "197_",
      };
    }
    case 5: {
      // Attempt 5: 13% radial, 6px blur, 1.5% grain. 70% Brand, 60% Perfumer. Notes: +Base (Level 3). Year FULL. Gender TRUE.
      return {
        blur: 6,
        brandLetters: 70,
        grain: 1.5,
        notes: 3,
        perfumerLetters: 60,
        radialMask: 13,
        showGender: true,
        yearMask: "FULL",
      };
    }
    case 6: {
      // Attempt 6: 100% radial, 0px blur, 0% grain. 100% Brand, 100% Perfumer. Notes: All. Year FULL. Gender TRUE.
      return {
        blur: 0,
        brandLetters: 100,
        grain: 0,
        notes: 3,
        perfumerLetters: 100,
        radialMask: 100,
        showGender: true,
        yearMask: "FULL",
      };
    }
    default: {
      return {
        blur: 10,
        brandLetters: 0,
        grain: 3,
        notes: 0,
        perfumerLetters: 0,
        radialMask: 0,
        showGender: false,
        yearMask: "____",
      };
    }
  }
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
  // Letters: ALL other characters including hyphen, period, ampersand, apostrof (masked as •)
  const SEPARATOR_REGEX = /(\s+)/;

  // Split into words by space only (capturing separators)
  const tokens = text.split(SEPARATOR_REGEX);

  const revealedTokens = tokens.map((token) => {
    // If token is just whitespace, return as is
    if (/^\s+$/.test(token)) return token;

    // Mask entire word at 0%
    if (pct === 0) return "_".repeat(token.length);

    const chars = token.split("");
    const lettersToReveal = Math.max(1, Math.round(chars.length * (pct / 100)));

    if (lettersToReveal >= chars.length) return token;

    const order = generateSmartRevealOrder(chars.length);
    const revealed = new Set(order.slice(0, lettersToReveal));

    return chars.map((c, i) => (revealed.has(i) ? c : "_")).join("");
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

    if (left >= subStart) order.push(left--);
    if (right < length) order.push(right++);
  }

  // Finally, reveal the first letter (Brand Capital)
  order.push(0);

  if (process.env.NODE_ENV === "development") {
    console.log(
      `SmartReveal(${length}): SubLen=${subLength}, Center=${centerAbsolute}, Order=${JSON.stringify(order)}`,
    );
  }
  return order;
}
