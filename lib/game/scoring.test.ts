
import { describe, it, expect } from 'vitest';
import { calculateBaseScore, calculateFinalScore, getRevealPercentages, revealLetters } from '@/lib/game/scoring';


describe('Scoring Logic', () => {
    describe('calculateBaseScore', () => {
        it('should return correct scores for attempts 1-6', () => {
            expect(calculateBaseScore(1)).toBe(1000);
            expect(calculateBaseScore(2)).toBe(700);
            expect(calculateBaseScore(3)).toBe(490);
            expect(calculateBaseScore(4)).toBe(343);
            expect(calculateBaseScore(5)).toBe(240);
            expect(calculateBaseScore(6)).toBe(168);
        });

        it('should return 1000 for attempt < 1 (defensive)', () => {
            expect(calculateBaseScore(0)).toBe(1000);
        });

        it('should return 0 for attempt > 6 (defensive)', () => {
            expect(calculateBaseScore(7)).toBe(0);
        });
    });

    describe('calculateFinalScore', () => {
        it('should apply xSolve bonus correctly', () => {
            // base 1000, xsolve 0.5 (+15% bonus? No, 1 + xsolve * 0.3)
            // xsolve range is typically 0-1? Or 0-100? Protocol says "xsolve_score float default 0".
            // Assuming 0.0 to 1.0 range based on "1 + xsolve * 0.3" structure (max 30% bonus).
            // Example: xsolve = 1.0 -> 1000 * (1 + 0.3) = 1300
            expect(calculateFinalScore(1000, 1.0)).toBe(1300);
            expect(calculateFinalScore(1000, 0.5)).toBe(1150);
            expect(calculateFinalScore(1000, 0.0)).toBe(1000);
        });

        it('should round correctly', () => {
            // 700 * 1.3 = 910
            expect(calculateFinalScore(700, 1.0)).toBe(910);
            // 343 * 1.3 = 445.9 -> 446
            expect(calculateFinalScore(343, 1.0)).toBe(446);
        });
    });
});

describe('Reveal Logic', () => {
    describe('getRevealPercentages', () => {
        it('should return correct progression for attempt 1', () => {
            const state = getRevealPercentages(1);
            expect(state.blur).toBe(32);
            expect(state.radialMask).toBe(0);
            expect(state.brandLetters).toBe(0);
            expect(state.yearMask).toBe('----');
        });

        it('should return correct progression for attempt 3', () => {
            const state = getRevealPercentages(3);
            expect(state.blur).toBe(16);
            expect(state.brandLetters).toBe(15);
            expect(state.yearMask).toBe('19--');
        });

        it('should return full reveal for attempt 6', () => {
            const state = getRevealPercentages(6);
            expect(state.blur).toBe(0);
            expect(state.brandLetters).toBe(100);
            expect(state.yearMask).toBe('FULL');
            expect(state.showGender).toBe(true);
        });
    });

    describe('revealLetters', () => {
        it('should hide all letters at 0%', () => {
            expect(revealLetters('Dior', 0)).toBe('••••');
        });

        it('should show all letters at 100%', () => {
            expect(revealLetters('Dior', 100)).toBe('Dior');
        });

        it('should reveal center letter first (15-25%)', () => {
            // "Dior" -> 4 chars. Center index 1 ('i') or 2 ('o'). 
            // Algorithm: floor((len-1)/2) -> floor(1.5) = 1 -> 'i'
            // 25% of 4 is 1 char.
            expect(revealLetters('Dior', 25)).toBe('•i••');
        });

        it('should reveal center outward correctly', () => {
            // "Chanel" -> 6 chars. Center 2 ('a').
            // 0% -> ••••••
            // 17% (1 char) -> ••a•••
            // 17% of 6 is 1.02 -> ceil -> 2 chars
            const res1 = revealLetters('Chanel', 17);
            // indices: 2 ('a') and 3 ('n') (Right neighbor first?)
            // Center is 2 ('a'). Next is right (3 'n').
            expect(res1).toBe('••an••');

            // 34% of 6 is 2.04 -> ceil -> 3 chars
            // Center (a), Right (n), Left (h)
            const res2 = revealLetters('Chanel', 34);
            expect(res2).toBe('•han••');

            // 50% (3 chars) -> •han•• (Left neighbor 1 'h')
            const res3 = revealLetters('Chanel', 50);
            expect(res3).toBe('•han••');
        });

        it('should always show separators', () => {
            expect(revealLetters('Yves Saint Laurent', 0)).toBe('•••• ••••• •••••••');
        });
    });
});
