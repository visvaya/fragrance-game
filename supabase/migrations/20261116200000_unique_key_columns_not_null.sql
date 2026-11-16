-- Columns of unique keys become NOT NULL: a UNIQUE key accepts any number of rows with NULL, so
-- "one game per player and day" (game_sessions, game_results), "one source per perfume and version"
-- and "one slug per perfume" did not hold for rows with a NULL there. No row had a NULL on
-- 2026-11-16, every insert path sets these columns (unique_slug through the set_unique_slug trigger),
-- and the foreign keys are CASCADE or NO ACTION, never SET NULL.
ALTER TABLE public.game_sessions
  ALTER COLUMN player_id SET NOT NULL,
  ALTER COLUMN challenge_id SET NOT NULL;
ALTER TABLE public.game_results
  ALTER COLUMN player_id SET NOT NULL,
  ALTER COLUMN challenge_id SET NOT NULL;
ALTER TABLE public.perfume_asset_sources
  ALTER COLUMN perfume_id SET NOT NULL;
ALTER TABLE public.perfumes
  ALTER COLUMN unique_slug SET NOT NULL;
