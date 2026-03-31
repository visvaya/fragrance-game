-- 1. Revoke remaining anon SELECT grants on private tables
--    All reads go through server actions using adminClient (service_role)
REVOKE SELECT ON public.game_sessions     FROM anon;
REVOKE SELECT ON public.game_results      FROM anon;
REVOKE SELECT ON public.player_streaks    FROM anon;
REVOKE SELECT ON public.player_profiles   FROM anon;
REVOKE SELECT ON public.user_sessions     FROM anon;

-- 2. Add minimum query length enforcement to search function (defense in depth)
--    Application layer already enforces this but the DB function should too.
CREATE OR REPLACE FUNCTION public.search_perfumes_unaccent_v2(
  search_query text,
  limit_count integer DEFAULT 60
)
RETURNS TABLE(id uuid, name text, year integer, brand_name text, concentration text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  search_norm TEXT;
  is_multiword BOOLEAN;
  tokens TEXT[];
  fuzzy_threshold REAL;
BEGIN
  -- Enforce minimum query length at DB level (defense in depth)
  IF LENGTH(search_query) < 3 THEN
    RETURN;
  END IF;

  search_norm := LOWER(public.f_unaccent(search_query));
  is_multiword := search_query LIKE '% %';
  tokens := string_to_array(search_norm, ' ');

  fuzzy_threshold := CASE
    WHEN LENGTH(search_query) <= 3 THEN 0.7
    WHEN LENGTH(search_query) <= 5 THEN 0.6
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
        AND LENGTH(search_query) >= 5
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
          OR (LENGTH(search_query) >= 5 AND c.name_phonetic = extensions.dmetaphone(search_query))
          OR (LENGTH(search_query) >= 5 AND c.brand_phonetic = extensions.dmetaphone(search_query))
          OR (LENGTH(search_query) >= 4 AND extensions.similarity(c.name_norm, search_norm) > fuzzy_threshold)
          OR (LENGTH(search_query) >= 4 AND extensions.similarity(c.brand_norm, search_norm) > fuzzy_threshold)
        )
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
    r.p5 DESC, r.p6 DESC, r.p_word DESC, r.p7 DESC, r.p8 DESC,
    r.name_length ASC,
    LOWER(r.brand_name),
    LOWER(r.name),
    r.concentration_rank,
    r.release_year ASC NULLS LAST
  LIMIT limit_count;
END;
$function$;
