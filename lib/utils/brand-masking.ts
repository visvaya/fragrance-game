/**
 * Masks the brand name progressively based on the number of attempts.
 * 
 * Logic from MVP_SPEC.md:
 * | attempts_count | Brand Reveal | Example (Dior) |
 * |----------------|--------------|----------------|
 * | 0-2            | 0%           | [Hidden]       |
 * | 3              | 15%          | •i••           |
 * | 4              | 40%          | Di••           |
 * | 5              | 70%          | Dio•           |
 * | 6              | 100%         | Dior           |
 */
export function maskBrand(brand: string, attemptsCount: number): string {
    if (attemptsCount <= 2) return '[Hidden]';

    // Return early for Full Reveal to avoid calculation overhead
    if (attemptsCount >= 6) return brand;

    const revealPercentages = {
        3: 0.15,
        4: 0.40,
        5: 0.70,
    };

    const revealPercent = revealPercentages[attemptsCount as keyof typeof revealPercentages] ?? 0;
    const revealCount = Math.ceil(brand.length * revealPercent);

    // Reveal characters from left to right
    return brand
        .split('')
        .map((char, i) => (i < revealCount ? char : '•'))
        .join('');
}

/**
 * Masks the release year.
 * Hidden as [?] for attempts < 5.
 * Visible from attempt 5 onwards.
 */
export function maskYear(year: number | null, attemptsCount: number): string | number {
    if (attemptsCount < 5) return '[?]';
    return year ?? '[Unknown]';
}
