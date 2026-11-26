-- Keep products that are not perfumes out of autocomplete, and restore 235 lost concentrations.
--
-- About 2 600 active rows carry a product type in the concentration field (aftershave, body and
-- hair mists and sprays, shower and after-bath colognes). None of them is certain, so none can be
-- a daily answer, yet autocomplete listed them next to the answer under the same name ("Delina"
-- Hair Perfume beside "Delina" Eau de Parfum), and picking one cost the player a guess. Owner
-- decision 2026-11-26: leave them out of suggestions. Perfume oils, attars and solid, cream or gel
-- perfumes stay: they are the same scents in another form.
--
-- 235 active rows lost their concentration at import although the source had one: the label's
-- slug collided with an existing label ("Lotion Apres Rasage" and "Lotion Apres-Rasage" share
-- lotion-apr-s-rasage, and concentrations.slug is unique) or the accented name failed to store.
-- source_record_slug still holds the label text; each of the 235 matches exactly one existing
-- label by slug (checked on production 2026-11-26). The ETL now reuses a label whose slug matches.
--
-- Non-ASCII characters are written as U& escapes so the file stays ASCII.

-- The view refresh takes an exclusive lock on perfume_autocomplete_cache (about 59 000 rows):
-- give up rather than queue behind a long reader, and bound the whole migration.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.concentrations
  ADD COLUMN is_perfume boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.concentrations.is_perfume IS
  'False for a product type that is not a perfume (aftershave, body or hair mist); autocomplete leaves such rows out.';

UPDATE public.concentrations
SET is_perfume = false
WHERE name IN (
  'After Shave',
  'After Shave Eau de Cologne',
  'After Shave Foam',
  'After Shave Locion',
  'After Shave Lotion',
  'After Shave Splash',
  'After Shave Sport',
  'After Shave Tonic',
  'After Shaving Lotion',
  'After Shaving Splash',
  'Aftershave',
  'Aftershave Eau de Toilette',
  'Aftershave Lotion',
  'Aftershave Splash',
  U&'Apr\00E8s Rasage',
  U&'Apr\00E8s-Rasage apaisant sans alcool',
  'Dopo Barba',
  'Dopobarba',
  'Dopobarba 0% Alcool',
  'Elect Rasierwasser',
  'Fresh After Shave',
  'Invigorating After Shave Lotion',
  'Lotion After Shave',
  U&'Lotion Apr\00E8s Rasage Concentr\00E9e',
  U&'Lotion Apr\00E8s-Rasage',
  'Lotion Avant-Rasage',
  U&'Lotion Fra\00EEche Apr\00E8s Rasage',
  'Lotion Vitale After Shave',
  'Low Alcohol After Shave',
  'Lozione Dopobarba',
  'Rasierwasser',
  'Sensitive After Shave',
  U&'Splash Apr\00E8s Rasage',
  'Tonico Dopobarba',
  U&'Tonique Apr\00E8s-Rasage',
  'After Bath Cologne',
  'After Bath Freshener',
  'All-Over Spray',
  'Aroma Mist',
  'Body & Hair Spray',
  'Body Cologne',
  'Body Cooler',
  'Body Fragrance',
  'Body Freshener',
  'Body Mist',
  'Body Parfum',
  'Body Splash',
  'Body Spray',
  'Body Spray Parfum',
  'Body Spritz',
  'Body Spritzer',
  'Body Tonic',
  'Body Water',
  'Bodyspray',
  'Brume Cheveux',
  U&'Brume Concentr\00E9e',
  'Brume Corps',
  'Brume Corps & Cheveux',
  'Brume Corps et Cheveux',
  'Brume de Parfum pour les Cheveux',
  U&'Brume Fra\00EEche pour le Corps',
  U&'Brume Fra\00EEcheur',
  U&'Brume Hydratante Parfum\00E9e pour le Corps',
  U&'Brume Parfum\00E9e',
  'Brume pour Cheveux',
  'Brume pour le Corps',
  'Brume pour les Cheveux',
  'Caressing Body Spray',
  U&'Eau de Fra\00EEcheur pour le Corps',
  'Eau de Paradis pour le Corps sans Alcool',
  'Eau de Soin pour le Corps',
  'Eau de Velours pour le Corps',
  U&'Eau Parfum\00E9e pour le Corps',
  'Eau pour le Corps',
  'Eau Tonique',
  U&'Eau Tonique d''\00C9t\00E9 pour le Corps',
  'Eau Tonique pour le Corps',
  'Essence Mist',
  'Fragrance Body Spray',
  'Fragrance Mist',
  'Fragrance Spritz',
  'Friction Tonique pour le Corps',
  'Hair & Body Cologne',
  'Hair & Body Mist',
  'Hair + Body Perfume',
  'Hair and Body Mist',
  'Hair Fragrance',
  'Hair Mist',
  'Hair Perfume',
  'Hair Spray',
  'Intense Perfume Mist',
  'L''Eau Scintillante pour le Corps',
  'Parfum Cheveux',
  'Parfum pour Cheveux',
  'Parfum pour les Cheveux',
  'Perfume & Bath Oil',
  'Perfume Body Spray',
  'Perfumed Body Spray',
  'Profumo per Capelli',
  'Refreshing Body Fragrance',
  'Sheer Perfume Mist',
  'Shimmer Mist',
  'Shower Cologne',
  'Spray Corps sans Alcool',
  'Spray Mist'
);

-- source_record_slug is "<brand>-<name>-<concentration>-<year>" in lower case (scripts/etl.py), with
-- year 0 when missing; the concentration text between them is slugified like the label slugs.
WITH lost AS (
  SELECT
    p.id,
    substr(
      p.source_record_slug,
      length(lower(b.name) || '-' || lower(p.name) || '-') + 1,
      length(p.source_record_slug)
        - length(lower(b.name) || '-' || lower(p.name) || '-')
        - length('-' || coalesce(p.release_year, 0)::text)
    ) AS concentration_text
  FROM public.perfumes AS p
  JOIN public.brands AS b ON b.id = p.brand_id
  WHERE p.concentration_id IS NULL
    AND p.source_record_slug !~ '-unknown-[0-9]+$'
    AND left(p.source_record_slug, length(lower(b.name) || '-' || lower(p.name) || '-'))
      = lower(b.name) || '-' || lower(p.name) || '-'
    AND right(p.source_record_slug, length('-' || coalesce(p.release_year, 0)::text))
      = '-' || coalesce(p.release_year, 0)::text
)
UPDATE public.perfumes AS p
SET concentration_id = c.id
FROM lost
JOIN public.concentrations AS c
  ON c.slug = btrim(regexp_replace(lost.concentration_text, '[^a-z0-9]+', '-', 'g'), '-')
WHERE p.id = lost.id;

-- The signature is unchanged, so CREATE OR REPLACE keeps the existing grants. Only the NOT EXISTS
-- filter is new; the rest is 20261125130000_autocomplete_connector_words_optional.
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
      -- Product types that are not perfumes never appear as suggestions.
      NOT EXISTS (
        SELECT 1 FROM concentrations k
        WHERE k.name = c.concentration_name AND NOT k.is_perfume
      )
      AND CASE
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

-- Autocomplete reads the restored concentrations from this view.
REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
