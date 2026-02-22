-- Migration: Update concentration_rank ordering in perfume_autocomplete_cache
-- Date: 2026-02-22
-- New order based on dataset popularity (EDT: 2823, EDP: 2796, Parfum: 1084, ...)
-- 1=EDT, 2=EDP, 3=PdT, 4=Parfum, 5=Pure Perfume, 6=Extrait, 7=EdC, 8=Eau Fraîche, 9=Oil, 99=rest

-- 1. Drop the materialized view (all indexes drop automatically)
DROP MATERIALIZED VIEW IF EXISTS public.perfume_autocomplete_cache;

-- 2. Recreate with updated concentration_rank
CREATE MATERIALIZED VIEW public.perfume_autocomplete_cache AS
SELECT
    p.id AS perfume_id,
    p.name,
    b.name AS brand_name,
    p.release_year,
    c.name AS concentration_name,
    lower(normalize_search_text(p.name))                        AS name_norm,
    lower(normalize_search_text(b.name))                        AS brand_norm,
    lower(normalize_search_text(b.name || ' ' || p.name))       AS brand_name_concat,
    lower(normalize_search_text(p.name || ' ' || b.name))       AS name_brand_concat,
    extensions.dmetaphone(p.name)                               AS name_phonetic,
    extensions.dmetaphone(b.name)                               AS brand_phonetic,
    CASE c.name
        WHEN 'Eau de Toilette'    THEN 1
        WHEN 'Eau de Parfum'      THEN 2
        WHEN 'Parfum de Toilette' THEN 3
        WHEN 'Parfum'             THEN 4
        WHEN 'Pure Perfume'       THEN 5
        WHEN 'Extrait de Parfum'  THEN 6
        WHEN 'Eau de Cologne'     THEN 7
        WHEN 'Eau Fraîche'        THEN 8
        WHEN 'Perfume Oil'        THEN 9
        ELSE 99
    END AS concentration_rank,
    length(p.name) AS name_length
FROM perfumes p
JOIN brands b ON b.id = p.brand_id
LEFT JOIN concentrations c ON c.id = p.concentration_id
WHERE p.is_active = true
WITH DATA;

-- 3. Recreate all indexes
CREATE INDEX idx_ac_cache_name_norm        ON public.perfume_autocomplete_cache USING btree (name_norm text_pattern_ops);
CREATE INDEX idx_ac_cache_brand_norm       ON public.perfume_autocomplete_cache USING btree (brand_norm text_pattern_ops);
CREATE INDEX idx_ac_cache_brand_name_concat ON public.perfume_autocomplete_cache USING btree (brand_name_concat text_pattern_ops);
CREATE INDEX idx_ac_cache_name_brand_concat ON public.perfume_autocomplete_cache USING btree (name_brand_concat text_pattern_ops);
CREATE INDEX idx_ac_cache_name_trgm        ON public.perfume_autocomplete_cache USING gin (name_norm gin_trgm_ops);
CREATE INDEX idx_ac_cache_brand_trgm       ON public.perfume_autocomplete_cache USING gin (brand_norm gin_trgm_ops);
CREATE INDEX idx_ac_cache_brand_name_trgm  ON public.perfume_autocomplete_cache USING gin (brand_name_concat gin_trgm_ops);
CREATE INDEX idx_ac_cache_name_brand_trgm  ON public.perfume_autocomplete_cache USING gin (name_brand_concat gin_trgm_ops);
CREATE INDEX idx_ac_cache_name_phonetic    ON public.perfume_autocomplete_cache USING btree (name_phonetic);
CREATE INDEX idx_ac_cache_brand_phonetic   ON public.perfume_autocomplete_cache USING btree (brand_phonetic);
CREATE INDEX idx_ac_cache_concentration_rank ON public.perfume_autocomplete_cache USING btree (concentration_rank);
CREATE INDEX idx_ac_cache_name_length      ON public.perfume_autocomplete_cache USING btree (name_length);

-- 4. Restore permissions
GRANT SELECT ON public.perfume_autocomplete_cache TO anon, authenticated;
