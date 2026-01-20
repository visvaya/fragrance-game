import { z } from 'zod';

export const perfumeSchema = z.object({
    id: z.string().uuid(),
    brand_id: z.string().uuid(),
    brand_name: z.string().optional(),
    name: z.string().min(1).max(200),
    unique_slug: z.string().optional(),
    release_year: z.number().int().min(1668).max(new Date().getFullYear() + 2).nullable(),
    concentration_id: z.string().uuid().nullable(),
    gender: z.string().nullable(),
    manufacturer_id: z.string().uuid().nullable(),
    is_uncertain: z.boolean().nullable(),
    is_linear: z.boolean().nullable(),
    games_played: z.number().int().nullable(),
    solve_rate: z.number().nullable(),
    top_notes: z.array(z.string()).nullable(),
    middle_notes: z.array(z.string()).nullable(),
    base_notes: z.array(z.string()).nullable(),
});

export const submitGuessSchema = z.object({
    sessionId: z.string().uuid(),
    perfumeId: z.string().uuid(),
    nonce: z.number().int(), // Changed to number as BigInt handling in JSON can be tricky, typically passed as number or string from client
});

export const autocompleteSchema = z.object({
    query: z.string().min(3).max(100),
    sessionId: z.string().uuid().optional(),
});
