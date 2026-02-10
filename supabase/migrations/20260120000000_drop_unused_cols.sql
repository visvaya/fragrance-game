-- Migration: Drop unused columns and update dependent views
-- Date: 2026-01-20
-- Description: Drops rating_count, rating_value, image_url, origin_url, main_accords from perfumes table.
--              Updates perfumes_public and perfume_autocomplete_cache to reflect these changes.

-- 1. Drop dependent views first
DROP MATERIALIZED VIEW IF EXISTS public.perfume_autocomplete_cache;
DROP VIEW IF EXISTS public.perfumes_public;

-- 2. Drop unused columns from perfumes
ALTER TABLE public.perfumes 
DROP COLUMN IF EXISTS rating_count CASCADE,
DROP COLUMN IF EXISTS rating_value CASCADE,
DROP COLUMN IF EXISTS image_url CASCADE,
DROP COLUMN IF EXISTS main_accords CASCADE,
DROP COLUMN IF EXISTS origin_url CASCADE;

-- 3. Recreate perfumes_public view
CREATE VIEW public.perfumes_public AS
SELECT
    id,
    brand_id,
    name,
    unique_slug,
    release_year,
    concentration_id,
    gender,
    manufacturer_id,
    is_uncertain,
    is_linear,
    -- New columns
    top_notes,
    middle_notes,
    base_notes,
    perfumers,
    games_played,
    solve_rate
FROM public.perfumes
WHERE is_active = true;

GRANT SELECT ON public.perfumes_public TO anon, authenticated;

-- 4. Recreate perfume_autocomplete_cache
-- Changed filter from rating_count >= 1 to is_active = true and xsolve_score IS NOT NULL (to prioritize game-ready)
-- Or just is_active = true. Let's use xsolve_score IS NOT NULL to limit to "known" perfumes.
CREATE MATERIALIZED VIEW public.perfume_autocomplete_cache AS
SELECT
    p.id AS perfume_id,
    p.name,
    b.name AS brand_name,
    p.release_year,
    LOWER(TRIM(p.name)) || '|' || LOWER(TRIM(b.name)) AS ui_key
FROM public.perfumes p
JOIN public.brands b ON b.id = p.brand_id
WHERE p.is_active = TRUE; -- Broader than xsolve, allows searching all imported valid perfumes

CREATE UNIQUE INDEX idx_ac_id ON public.perfume_autocomplete_cache(perfume_id);
CREATE INDEX idx_ac_trigram ON public.perfume_autocomplete_cache USING GIN (name gin_trgm_ops);

GRANT SELECT ON public.perfume_autocomplete_cache TO anon, authenticated;
