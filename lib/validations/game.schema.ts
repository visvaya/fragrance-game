import { z } from "zod";

export const perfumeSchema = z.object({
  base_notes: z.array(z.string()).nullable(),
  brand_id: z.string().uuid(),
  brand_name: z.string().optional(),
  concentration_id: z.string().uuid().nullable(),
  games_played: z.number().int().nullable(),
  gender: z.string().nullable(),
  id: z.string().uuid(),
  is_linear: z.boolean().nullable(),
  is_uncertain: z.boolean().nullable(),
  manufacturer_id: z.string().uuid().nullable(),
  middle_notes: z.array(z.string()).nullable(),
  name: z.string().min(1).max(200),
  release_year: z
    .number()
    .int()
    .min(1668)
    .max(new Date().getFullYear() + 2)
    .nullable(),
  solve_rate: z.number().nullable(),
  top_notes: z.array(z.string()).nullable(),
  unique_slug: z.string().optional(),
});

export const submitGuessSchema = z.object({
  nonce: z.number().int(), // Changed to number as BigInt handling in JSON can be tricky, typically passed as number or string from client
  perfumeId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const autocompleteSchema = z.object({
  query: z.string().min(3).max(100),
  sessionId: z.string().uuid().optional(),
});
