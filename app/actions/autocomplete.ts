'use server';

import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/redis';
import { autocompleteSchema } from '@/lib/validations/game.schema';
import { maskBrand, maskYear } from '@/lib/utils/brand-masking';
import { z } from 'zod';

export type PerfumeSuggestion = {
    perfume_id: string;
    display_name: string;
    brand_masked: string;
    name: string;
    concentration: string | null;
    year: string | null;
};

export async function searchPerfumes(
    query: string,
    sessionId?: string,
    currentAttempt?: number
): Promise<PerfumeSuggestion[]> {
    // 1. Input Validation
    const result = autocompleteSchema.safeParse({ query, sessionId });

    if (!result.success) {
        return [];
    }

    const { query: validatedQuery, sessionId: validatedSessionId } = result.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Rate Limiting (Server Actions Tier)
    if (user) {
        await checkRateLimit('autocomplete', user.id);
    }

    // 3. Brand Masking Sync
    // Use currentAttempt from client instead of querying DB
    const attemptsCount = currentAttempt ?? 0;

    // 4. Database Query using RPC with unaccent support
    const { data: perfumes, error: dbError } = await supabase
        .rpc('search_perfumes_unaccent', {
            search_query: validatedQuery,
            limit_count: 10
        });

    if (dbError) {
        console.error('Autocomplete DB Error:', dbError);
        return [];
    }

    if (!perfumes) return [];

    // 5. Transform & Mask Results
    const transformed = perfumes.map((p: any) => {
        // Flattened view returns brand_name directly
        const brandName = p.brand_name ?? 'Unknown Brand';
        const maskedBrand = maskBrand(brandName, attemptsCount);
        const maskedYear = maskYear(p.year, attemptsCount);

        // Logic handled in client for display, but we provide raw pieces
        const concentration = p.concentration || null;
        const name = p.name;

        // Legacy display_name used as fallback
        const displayName = `${maskedBrand} - ${name}${concentration ? ' ' + concentration : ''} (${maskedYear || ''})`;

        return {
            perfume_id: p.id,
            display_name: displayName,
            brand_masked: maskedBrand,
            name: name,
            concentration: concentration,
            year: maskedYear,
        };
    });

    // 6. Custom Sorting: Exact Prefix/Match Priority
    const lowerQuery = validatedQuery.toLowerCase();

    return transformed.sort((a: PerfumeSuggestion, b: PerfumeSuggestion) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        // --- 1. Token Overlap Score ---
        // For query "marly delina", we want "Parfums de Marly Delina" to win over "Delina Exclusif" (maybe) 
        // OR better: match how many query words are present in target.
        const queryTokens = lowerQuery.split(/\s+/).filter(t => t.length > 0);

        const getScore = (suggestion: PerfumeSuggestion) => {
            const targetText = (suggestion.name + " " + (suggestion.brand_masked.includes('•') ? suggestion.name : suggestion.brand_masked)).toLowerCase();
            let score = 0;

            // Exact full match bonus
            if (suggestion.name.toLowerCase() === lowerQuery) score += 100;

            // Token matches
            let matchedTokens = 0;
            for (const token of queryTokens) {
                if (targetText.includes(token)) matchedTokens++;
            }
            score += matchedTokens * 10;

            // Prefix bonus
            if (suggestion.name.toLowerCase().startsWith(lowerQuery)) score += 5;

            return score;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreA !== scoreB) return scoreB - scoreA; // High score first

        // --- 2. Fallback: Alphabetical ---
        return nameA.localeCompare(nameB);
    });
}
