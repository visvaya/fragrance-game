
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
            return { blur: 32, radialMask: 0, brandLetters: 0, perfumerLetters: 0, yearMask: '----', showGender: false };
        case 2:
            return { blur: 24, radialMask: 10, brandLetters: 0, perfumerLetters: 0, yearMask: '1---', showGender: false };
        case 3:
            return { blur: 16, radialMask: 25, brandLetters: 15, perfumerLetters: 10, yearMask: '19--', showGender: false };
        case 4:
            return { blur: 10, radialMask: 45, brandLetters: 40, perfumerLetters: 30, yearMask: '197-', showGender: false };
        case 5:
            return { blur: 4, radialMask: 70, brandLetters: 70, perfumerLetters: 60, yearMask: 'FULL', showGender: true };
        case 6:
            return { blur: 0, radialMask: 100, brandLetters: 100, perfumerLetters: 100, yearMask: 'FULL', showGender: true };
        default:
            // Fallback to attempt 1
            return { blur: 32, radialMask: 0, brandLetters: 0, perfumerLetters: 0, yearMask: '----', showGender: false };
    }
}

/**
 * Reveals a percentage of letters in a string, starting from the center outward.
 * Separators (spaces, hyphens) are always visible.
 * Hidden letters are replaced with '•'.
 */
export function revealLetters(text: string, percentage: number): string {
    if (!text) return "";
    if (percentage <= 0) return text.replace(/[^\s-]/g, '•'); // Hide all except separators
    if (percentage >= 100) return text;

    const chars = text.split('');
    const revealTarget = Math.ceil((text.replace(/[\s-]/g, '').length * percentage) / 100);

    // Simple center-outward logic for whole string
    // Better UX: Reveal center-outward per WORD (token)?
    // Spec says: "Letters revealed from center of token outward" -> assuming whole string for simplicity first or as per prompt "token center outward".
    // Let's implement per-token (word) center-outward as it looks better for multi-word brands like "Yves Saint Laurent".

    return text.split(/(\s+|-)/).map(token => {
        if (/^[\s-]+$/.test(token)) return token; // Separator
        return revealTokenCenterOutward(token, percentage);
    }).join('');
}

function revealTokenCenterOutward(token: string, percentage: number): string {
    const len = token.length;
    if (len === 0) return token;

    // Number of letters to show in this token
    const countToShow = Math.ceil(len * (percentage / 100));

    if (countToShow >= len) return token;
    if (countToShow <= 0) return '•'.repeat(len);

    const centerIndex = Math.floor((len - 1) / 2);
    const indicesToShow = new Set<number>();

    // Always show center char first
    indicesToShow.add(centerIndex);

    let left = centerIndex - 1;
    let right = centerIndex + 1;

    while (indicesToShow.size < countToShow) {
        // Expand outward: Right, then Left (arbitrary preference, or alternate)
        // Let's alternate Right -> Left
        if (right < len) {
            indicesToShow.add(right);
            right++;
        }
        if (indicesToShow.size < countToShow && left >= 0) {
            indicesToShow.add(left);
            left--;
        }
    }

    // Build result
    let result = '';
    for (let i = 0; i < len; i++) {
        if (indicesToShow.has(i)) {
            result += token[i];
        } else {
            result += '•';
        }
    }
    return result;
}
