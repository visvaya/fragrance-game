-- Migration: Fuzzy multi-word search
-- Date: 2026-02-22
-- Problem: Multi-word queries (e.g. "Mandarine basiliz") return zero results when any
--          token has even a single typo. The ELSE branch used pure ILIKE per token
--          with zero fuzzy tolerance.
-- Fix: Add word_similarity fallback per token for tokens >= 4 characters.
--      Token passes if: exact substring match (ILIKE) OR word_similarity > 0.35.
--      Threshold 0.35 catches 1-2 char substitutions (e.g. "basiliz"→"basilic" ≈ 0.56).
--      Short tokens (<4 chars) still require exact match to avoid false positives.
-- Note: % operator and word_similarity are in the `extensions` schema (pg_trgm).
--       Inside functions with SET search_path = public, pg_catalog the % operator
--       is unreachable, so we use extensions.similarity() and extensions.word_similarity()
--       as fully-qualified function calls instead.
-- Applies to: search_perfumes_unaccent (v1) and search_perfumes_unaccent_v2

-- ============================================================================
-- 1. search_perfumes_unaccent (v1 — reads from perfumes_public view)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_perfumes_unaccent(
  search_query TEXT,
  limit_count INT DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  year INT,
  brand_name TEXT,
  concentration TEXT
) AS $$
DECLARE
  is_multiword BOOLEAN;
  tokens TEXT[];
  fuzzy_threshold REAL;
BEGIN
  is_multiword := search_query LIKE '% %';
  tokens := string_to_array(f_unaccent(lower(search_query)), ' ');

  fuzzy_threshold := CASE
    WHEN LENGTH(search_query) <= 3 THEN 0.7
    WHEN LENGTH(search_query) <= 5 THEN 0.6
    ELSE 0.5
  END;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.release_year AS year,
    p.brand_name,
    p.concentration_name AS concentration
  FROM perfumes_public p
  WHERE
    CASE
      WHEN NOT is_multiword THEN (
        f_unaccent(p.name) ILIKE '%' || f_unaccent(search_query) || '%'
        OR f_unaccent(p.brand_name) ILIKE '%' || f_unaccent(search_query) || '%'
        OR (LENGTH(search_query) >= 5 AND LENGTH(p.name) >= 5 AND extensions.dmetaphone(p.name) = extensions.dmetaphone(search_query))
        OR (LENGTH(search_query) >= 5 AND LENGTH(p.brand_name) >= 5 AND extensions.dmetaphone(p.brand_name) = extensions.dmetaphone(search_query))
        OR (LENGTH(search_query) >= 4 AND extensions.similarity(f_unaccent(p.name), f_unaccent(search_query)) > fuzzy_threshold)
        OR (LENGTH(search_query) >= 4 AND extensions.similarity(f_unaccent(p.brand_name), f_unaccent(search_query)) > fuzzy_threshold)
      )
      -- MULTI WORD: all tokens must match — via exact substring OR fuzzy (word_similarity > 0.35)
      ELSE (
        NOT EXISTS (
          SELECT 1 FROM unnest(tokens) AS token
          WHERE
            f_unaccent(lower(p.brand_name || ' ' || p.name)) NOT ILIKE '%' || token || '%'
            AND NOT (
              LENGTH(token) >= 4
              AND extensions.word_similarity(token, f_unaccent(lower(p.brand_name || ' ' || p.name))) > 0.35
            )
        )
      )
    END
  ORDER BY
    CASE WHEN LOWER(f_unaccent(p.name)) = LOWER(f_unaccent(search_query)) THEN 1 ELSE 0 END DESC,
    CASE WHEN LOWER(f_unaccent(p.brand_name)) = LOWER(f_unaccent(search_query)) THEN 1 ELSE 0 END DESC,
    CASE WHEN LOWER(f_unaccent(p.brand_name || ' ' || p.name)) LIKE LOWER(f_unaccent(search_query)) || '%' THEN 1 ELSE 0 END DESC,
    CASE WHEN LOWER(f_unaccent(p.name || ' ' || p.brand_name)) LIKE LOWER(f_unaccent(search_query)) || '%' THEN 1 ELSE 0 END DESC,
    CASE WHEN LOWER(f_unaccent(p.name)) LIKE LOWER(f_unaccent(search_query)) || '%' THEN 1 ELSE 0 END DESC,
    CASE WHEN LOWER(f_unaccent(p.brand_name)) LIKE LOWER(f_unaccent(search_query)) || '%' THEN 1 ELSE 0 END DESC,
    CASE WHEN (
      NOT is_multiword AND LENGTH(search_query) >= 5 AND (
        (LENGTH(p.name) >= 5 AND extensions.dmetaphone(p.name) = extensions.dmetaphone(search_query))
        OR (LENGTH(p.brand_name) >= 5 AND extensions.dmetaphone(p.brand_name) = extensions.dmetaphone(search_query))
      )
    ) THEN 1 ELSE 0 END DESC,
    CASE
      WHEN f_unaccent(p.brand_name || ' ' || p.name) ILIKE '%' || f_unaccent(search_query) || '%'
      THEN 1000 - POSITION(LOWER(f_unaccent(search_query)) IN LOWER(f_unaccent(p.brand_name || ' ' || p.name)))
      ELSE 0
    END DESC,
    LENGTH(p.name) ASC,
    LOWER(p.brand_name),
    LOWER(p.name),
    CASE p.concentration_name
      WHEN 'Eau de Toilette'       THEN 1
      WHEN 'Eau de Parfum'         THEN 2
      WHEN 'Eau de Parfum Intense' THEN 3
      WHEN 'Parfum'                THEN 4
      WHEN 'Extrait de Parfum'     THEN 5
      WHEN 'Eau de Cologne'        THEN 6
      ELSE 10
    END,
    p.release_year ASC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql VOLATILE
SET search_path = public, pg_catalog;

-- ============================================================================
-- 2. search_perfumes_unaccent_v2 (reads from perfume_autocomplete_cache)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_perfumes_unaccent_v2(
  search_query TEXT,
  limit_count INT DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  year INT,
  brand_name TEXT,
  concentration TEXT
) AS $$
DECLARE
  search_norm TEXT;
  is_multiword BOOLEAN;
  tokens TEXT[];
  fuzzy_threshold REAL;
BEGIN
  search_norm := LOWER(public.f_unaccent(search_query));
  is_multiword := search_query LIKE '% %';
  tokens := string_to_array(search_norm, ' ');

  fuzzy_threshold := CASE
    WHEN LENGTH(search_query) <= 3 THEN 0.7
    WHEN LENGTH(search_query) <= 5 THEN 0.6
    ELSE 0.5
  END;

  EXECUTE format('SET pg_trgm.similarity_threshold = %s', fuzzy_threshold);

  RETURN QUERY
  WITH ranked_results AS (
    SELECT
      c.perfume_id,
      c.name,
      c.release_year,
      c.brand_name,
      c.concentration_name,
      c.name_length,
      c.concentration_rank,
      (c.name_norm = search_norm)::INT AS p1,
      (c.brand_norm = search_norm)::INT AS p2,
      (c.brand_name_concat LIKE search_norm || '%')::INT AS p3,
      (c.name_brand_concat LIKE search_norm || '%')::INT AS p4,
      (c.name_norm LIKE search_norm || '%')::INT AS p5,
      (c.brand_norm LIKE search_norm || '%')::INT AS p6,
      (
        NOT is_multiword
        AND LENGTH(search_query) > 2
        AND (
          c.name_phonetic = extensions.dmetaphone(search_query)
          OR c.brand_phonetic = extensions.dmetaphone(search_query)
        )
      )::INT AS p7,
      CASE
        WHEN c.brand_name_concat LIKE '%' || search_norm || '%'
        THEN 1000 - POSITION(search_norm IN c.brand_name_concat)
        ELSE 0
      END AS p8
    FROM perfume_autocomplete_cache c
    WHERE
      CASE
        WHEN NOT is_multiword THEN (
          c.name_norm ILIKE '%' || search_norm || '%'
          OR c.brand_norm ILIKE '%' || search_norm || '%'
          OR (LENGTH(search_query) > 2 AND c.name_phonetic = extensions.dmetaphone(search_query))
          OR (LENGTH(search_query) > 2 AND c.brand_phonetic = extensions.dmetaphone(search_query))
          OR (LENGTH(search_query) >= 4 AND c.name_norm % search_norm)
          OR (LENGTH(search_query) >= 4 AND c.brand_norm % search_norm)
        )
        -- MULTI WORD: all tokens must match — via exact substring OR fuzzy (word_similarity > 0.35)
        ELSE (
          NOT EXISTS (
            SELECT 1 FROM unnest(tokens) AS token
            WHERE
              c.brand_name_concat NOT ILIKE '%' || token || '%'
              AND NOT (
                LENGTH(token) >= 4
                AND extensions.word_similarity(token, c.brand_name_concat) > 0.35
              )
          )
        )
      END
  )
  SELECT
    r.perfume_id AS id,
    r.name,
    r.release_year AS year,
    r.brand_name,
    r.concentration_name AS concentration
  FROM ranked_results r
  ORDER BY
    r.p1 DESC, r.p2 DESC, r.p3 DESC, r.p4 DESC,
    r.p5 DESC, r.p6 DESC, r.p7 DESC, r.p8 DESC,
    r.name_length ASC,
    LOWER(r.brand_name),
    LOWER(r.name),
    r.concentration_rank,
    r.release_year ASC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql VOLATILE
SET search_path = public, pg_catalog;
