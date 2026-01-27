
import { MAX_GUESSES } from '@/lib/constants';

/**
 * Scoring and Reveal Logic for Fragrance Game
 */

export interface RevealState {
    blur: number;       // Blur radius in px
    radialMask: number; // Percentage (0-100)
    brandLetters: number; // Percentage (0-100) of brand letters revealed
    perfumerLetters: number; // Percentage (0-100) of perfumer letters revealed
    yearMask: string;   // '----' or full year
    showGender: boolean;
}

export type GameStatus = 'active' | 'won' | 'lost' | 'abandoned';

export interface GameResult {
    status: GameStatus;
    score: number;
    scoreRaw: number;
    attempts: number;
    timeSeconds: number; // Duration of the game
    isRanked: boolean;
    rankedReason?: string;
}

const ATTEMPT_SCORES = [1000, 700, 490, 343, 240, 168];

/**
 * Calculates the base score based on the number of attempts used.
 * Formula: 1000 * (0.7 ^ (attempts - 1))
 */
export function calculateBaseScore(attempts: number): number {
    if (attempts < 1) return 1000;
    if (attempts > MAX_GUESSES) return 0; // Should be handled as lost game
    // Use pre-calculated values to avoid floating point drift and ensure exact match with spec
    return ATTEMPT_SCORES[attempts - 1];
}

/**
 * Calculates the final score including the xSolve difficulty bonus.
 * Formula: base_score * (1 + xsolve_score * 0.3)
 */
export function calculateFinalScore(baseScore: number, xsolveScore: number): number {
    if (baseScore <= 0) return 0;
    // Apply bonus and strict rounding to integer
    return Math.round(baseScore * (1 + (xsolveScore * 0.3)));
}

/**
 * Returns the visual reveal state for a given attempt number (1-6).
 */
export function getRevealPercentages(attempt: number): RevealState {
    // Ensure attempt is clamped 1-6
    const safeAttempt = Math.max(1, Math.min(MAX_GUESSES, attempt));

    switch (safeAttempt) {
        case 1:
            return { blur: 10, radialMask: 0, brandLetters: 0, perfumerLetters: 0, yearMask: '----', showGender: false };
        case 2:
            return { blur: 9.5, radialMask: 10, brandLetters: 0, perfumerLetters: 0, yearMask: '1---', showGender: false };
        case 3:
            return { blur: 8.5, radialMask: 25, brandLetters: 15, perfumerLetters: 10, yearMask: '19--', showGender: false };
        case 4:
            return { blur: 7.5, radialMask: 45, brandLetters: 40, perfumerLetters: 30, yearMask: '197-', showGender: false };
        case 5:
            return { blur: 6, radialMask: 70, brandLetters: 70, perfumerLetters: 60, yearMask: 'FULL', showGender: true };
        case 6:
            return { blur: 0, radialMask: 100, brandLetters: 100, perfumerLetters: 100, yearMask: 'FULL', showGender: true };
        default:
            // Fallback to attempt 1
            return { blur: 10, radialMask: 0, brandLetters: 0, perfumerLetters: 0, yearMask: '----', showGender: false };
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

    const revealedTokens = tokens.map(token => {
        // If token is just whitespace, return as is
        if (/^\s+$/.test(token)) return token;

        // Mask entire word at 0%
        if (pct === 0) return "_".repeat(token.length);

        const chars = token.split("");
        const lettersToReveal = Math.round(chars.length * (pct / 100));

        if (lettersToReveal >= chars.length) return token;

        const order = generateCenterOutOrder(chars.length);
        const revealed = new Set(order.slice(0, lettersToReveal));

        return chars.map((c, i) => revealed.has(i) ? c : "_").join("");
    });

    return revealedTokens.join("");
}

/**
 * Generate indices in center-out order for a word
 * Result: [center... toward end... toward beginning]
 */
function generateCenterOutOrder(length: number): number[] {
    const center = Math.floor(length / 2);
    const order: number[] = [];

    // Start from center
    if (length % 2 === 0) {
        // Even length: e.g. 4 -> indices 0,1,2,3. Center 2.
        // Spec says: "Even length: Right-center (matches len/2), then..."
        // Plan example "Jean" (4): indices 1,2 are center?
        // Plan: "Jean" (4): Right-center: 2(a), Left-center: 1(e).
        // My Logic:
        // center = 2.
        // Order: center-1 (1), center (2). (Plan said: 2, 3, 1, 0. Wait.)
        // Let's follow the Plan ALGORITHM precisely:
        // "Right-center (length/2), then +1...+end, then left-center (-1), then -2...beginning"
        // length/2 = 2.
        // So start with 2.
        order.push(center);
        // Then +1...
        for (let i = center + 1; i < length; i++) order.push(i);
        // Then left-center (center - 1)
        if (center - 1 >= 0) {
            order.push(center - 1); // 1
            // Then -2... beginning
            for (let i = center - 2; i >= 0; i--) order.push(i);
        }
        // Result for 4: [2, 3, 1, 0]. Matches Plan Example "Jean".
        return order;
    } else {
        // Odd length: center index.
        order.push(center);
        // Then toward end
        for (let i = center + 1; i < length; i++) order.push(i);
        // Then toward beginning
        for (let i = center - 1; i >= 0; i--) order.push(i);
        return order;
    }
}
