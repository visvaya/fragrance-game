/**
 * Shared types for the fragrance game.
 */

export type PerfumeSuggestion = {
  brand_masked: string;
  brand_norm: string;
  concentration: string | null;
  display_name: string;
  name: string;
  name_norm: string;
  perfume_id: string;
  raw_year: number | null;
  year: string | null;
};
