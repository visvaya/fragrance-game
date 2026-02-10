-- Improved autocomplete: Exact Name > Exact Brand > Concat Starts With > Name/Brand Starts With > Phonetic > Contains (with position score)
-- Tokenization for multi-word queries to prevent phonetic/fuzzy collisions

-- Make sure extension is available (skip indexes as they exist)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP FUNCTION IF EXISTS search_perfumes_unaccent(TEXT, INT);

CREATE OR REPLACE FUNCTION search_perfumes_unaccent(
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
BEGIN
  -- Detect multi-word query
  is_multiword := search_query LIKE '% %';
  
  -- Tokenize query (unaccented, lowercased, split by space)
  tokens := string_to_array(f_unaccent(lower(search_query)), ' ');

  -- Set similarity threshold higher to reduce noise
  SET pg_trgm.similarity_threshold = 0.4;

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.release_year as year,
    p.brand_name,
    p.concentration_name as concentration
  FROM perfumes_public p
  WHERE 
    CASE 
      -- SINGLE WORD: Use full logic including fuzzy and phonetic
      WHEN NOT is_multiword THEN (
        f_unaccent(p.name) ILIKE '%' || f_unaccent(search_query) || '%'
        OR f_unaccent(p.brand_name) ILIKE '%' || f_unaccent(search_query) || '%'
        OR (LENGTH(search_query) > 2 AND dmetaphone(p.name) = dmetaphone(search_query))
        OR (LENGTH(search_query) > 2 AND dmetaphone(p.brand_name) = dmetaphone(search_query))
        OR (LENGTH(search_query) > 2 AND f_unaccent(p.name) % f_unaccent(search_query))
        OR (LENGTH(search_query) > 2 AND f_unaccent(p.brand_name) % f_unaccent(search_query))
      )
      -- MULTI WORD: ALL tokens must appear in (brand + name), disable phonetic/fuzzy to avoid collisions
      ELSE (
        NOT EXISTS (
          SELECT 1 FROM unnest(tokens) AS token
          WHERE f_unaccent(lower(p.brand_name || ' ' || p.name)) NOT ILIKE '%' || token || '%'
        )
      )
    END
  ORDER BY
    -- Priority 1: Exact match on Name
    CASE WHEN LOWER(f_unaccent(p.name)) = LOWER(f_unaccent(search_query)) THEN 1 ELSE 0 END DESC,
    -- Priority 2: Exact match on Brand
    CASE WHEN LOWER(f_unaccent(p.brand_name)) = LOWER(f_unaccent(search_query)) THEN 1 ELSE 0 END DESC,
    -- Priority 3: Brand + Name starts with query (Perfect for "Gaultier Le Male")
    CASE WHEN LOWER(f_unaccent(p.brand_name || ' ' || p.name)) LIKE LOWER(f_unaccent(search_query)) || '%' THEN 1 ELSE 0 END DESC,
    -- Priority 4: Name + Brand starts with query
    CASE WHEN LOWER(f_unaccent(p.name || ' ' || p.brand_name)) LIKE LOWER(f_unaccent(search_query)) || '%' THEN 1 ELSE 0 END DESC,
    -- Priority 5: Name starts with query
    CASE WHEN LOWER(f_unaccent(p.name)) LIKE LOWER(f_unaccent(search_query)) || '%' THEN 1 ELSE 0 END DESC,
    -- Priority 6: Brand starts with query
    CASE WHEN LOWER(f_unaccent(p.brand_name)) LIKE LOWER(f_unaccent(search_query)) || '%' THEN 1 ELSE 0 END DESC,
    -- Priority 7: Phonetic match (Only relevant for single-word queries due to WHERE clause)
    CASE WHEN (
      NOT is_multiword AND LENGTH(search_query) > 2 AND (
        dmetaphone(p.name) = dmetaphone(search_query)
        OR dmetaphone(p.brand_name) = dmetaphone(search_query)
      )
    ) THEN 1 ELSE 0 END DESC,
    -- Priority 8: Contains match with positional ranking
    CASE 
      WHEN f_unaccent(p.brand_name || ' ' || p.name) ILIKE '%' || f_unaccent(search_query) || '%' 
      THEN 1000 - POSITION(LOWER(f_unaccent(search_query)) IN LOWER(f_unaccent(p.brand_name || ' ' || p.name)))
      ELSE 0 
    END DESC,
    -- Final tie-breakers
    LENGTH(p.name) ASC, -- Prefer shortest name matches
    LOWER(p.brand_name),
    LOWER(p.name),
    -- Concentration Sort Order (User specified: EDT > EDP > EDP Intense > Parfum > Extrait > Cologne)
    CASE p.concentration_name
        WHEN 'Eau de Toilette' THEN 1
        WHEN 'Eau de Parfum' THEN 2
        WHEN 'Eau de Parfum Intense' THEN 3
        WHEN 'Parfum' THEN 4
        WHEN 'Extrait de Parfum' THEN 5
        WHEN 'Eau de Cologne' THEN 6
        ELSE 10 -- Other/Unknown
    END,
    p.release_year ASC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql VOLATILE;
