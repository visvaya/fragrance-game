-- Let an autocomplete query say "and" or "et" where the name has "&".
--
-- The cache strips "&" from names ("Blood Orange & Basil" is stored as "blood orange  basil"), and
-- the multi-word filter requires every query token in brand_name_concat, so "Blood Orange and
-- Basil" found nothing. The connector words "and" and "et" are no longer required to match, and
-- they are never the longest token that the trigram prefilter uses. Ranking is unchanged, so a
-- name that really contains the word still ranks higher when typed in full.
--
-- The signature is unchanged, so CREATE OR REPLACE keeps the existing grants.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.search_perfumes_unaccent_v2(search_query text, limit_count integer DEFAULT 60)
 RETURNS TABLE(id uuid, name text, year integer, brand_name text, concentration text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  search_norm TEXT;
  is_multiword BOOLEAN;
  tokens TEXT[];
  longest_token TEXT;
  fuzzy_threshold REAL;
  -- Words a player may type where the name has "&", which the cache strips.
  connectors CONSTANT TEXT[] := ARRAY['and', 'et'];
BEGIN
  search_norm := btrim(LOWER(public.normalize_search_text(search_query)));
  IF LENGTH(search_norm) < 3 THEN
    RETURN;
  END IF;

  -- Thresholds for the % and <% prefilters below, local to the transaction. A function-level
  -- SET clause for these settings is refused to the migration role on hosted Supabase.
  PERFORM set_config('pg_trgm.similarity_threshold', '0.5', true);
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.35', true);

  tokens := array_remove(string_to_array(search_norm, ' '), '');
  is_multiword := cardinality(tokens) > 1;
  SELECT t INTO longest_token FROM unnest(tokens) AS t
    WHERE t <> ALL (connectors) ORDER BY LENGTH(t) DESC LIMIT 1;

  fuzzy_threshold := CASE
    WHEN LENGTH(search_norm) <= 3 THEN 0.7
    WHEN LENGTH(search_norm) <= 5 THEN 0.6
    ELSE 0.5
  END;

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
        (' ' || c.brand_norm || ' ') LIKE '% ' || search_norm || ' %'
        OR (' ' || c.name_norm || ' ') LIKE '% ' || search_norm || ' %'
      )::INT AS p_word,
      (
        NOT is_multiword
        AND LENGTH(search_norm) >= 5
        AND (
          c.name_phonetic = extensions.dmetaphone(btrim(search_query))
          OR c.brand_phonetic = extensions.dmetaphone(btrim(search_query))
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
          OR (LENGTH(search_norm) >= 5 AND c.name_phonetic = extensions.dmetaphone(btrim(search_query)))
          OR (LENGTH(search_norm) >= 5 AND c.brand_phonetic = extensions.dmetaphone(btrim(search_query)))
          OR (
            LENGTH(search_norm) >= 4
            AND c.name_norm OPERATOR(extensions.%) search_norm
            AND extensions.similarity(c.name_norm, search_norm) > fuzzy_threshold
          )
          OR (
            LENGTH(search_norm) >= 4
            AND c.brand_norm OPERATOR(extensions.%) search_norm
            AND extensions.similarity(c.brand_norm, search_norm) > fuzzy_threshold
          )
        )
        ELSE (
          (
            c.brand_name_concat ILIKE '%' || longest_token || '%'
            OR (
              LENGTH(longest_token) >= 4
              AND longest_token OPERATOR(extensions.<%) c.brand_name_concat
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM unnest(tokens) AS token
            WHERE
              token <> ALL (connectors)
              AND c.brand_name_concat NOT ILIKE '%' || token || '%'
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
    r.p5 DESC, r.p6 DESC, r.p_word DESC, r.p7 DESC, r.p8 DESC,
    r.name_length ASC,
    LOWER(r.brand_name),
    LOWER(r.name),
    r.concentration_rank,
    r.release_year ASC NULLS LAST
  LIMIT limit_count;
END;
$function$;
