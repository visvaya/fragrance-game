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
    year: string | number;
};

export async function searchPerfumes(
    query: string,
    sessionId?: string
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
    let attemptsCount = 0;
    if (validatedSessionId) {
        const { data: session, error } = await supabase
            .from('game_sessions')
            .select('attempts_count, player_id')
            .eq('id', validatedSessionId)
            .single();

        if (session && !error) {
            if (user && session.player_id === user.id) {
                attemptsCount = session.attempts_count ?? 0;
            }
        }
    }

    // 4. Database Query
    // Using the updated perfumes_public view which now includes brand_name and concentration_name
    const { data: perfumes, error: dbError } = await supabase
        .from('perfumes_public')
        .select('id, name, release_year, brand_name, concentration_name')
        .or(`name.ilike.%${validatedQuery}%,brand_name.ilike.%${validatedQuery}%`)
        .limit(10);

    if (dbError) {
        console.error('Autocomplete DB Error:', dbError);
        return [];
    }

    if (!perfumes) return [];

    // 5. Transform & Mask Results
    return perfumes.map((p: any) => {
        // Flattened view returns brand_name directly
        const brandName = p.brand_name ?? 'Unknown Brand';
        const maskedBrand = maskBrand(brandName, attemptsCount);
        const maskedYear = maskYear(p.release_year, attemptsCount);
        const concentration = p.concentration_name ? ` ${p.concentration_name}` : '';

        const displayName = `${maskedBrand} - ${p.name}${concentration} (${maskedYear})`;

        return {
            perfume_id: p.id,
            display_name: displayName,
            brand_masked: maskedBrand,
            name: `${p.name}${concentration}`,
            year: maskedYear,
        };
    });
}
