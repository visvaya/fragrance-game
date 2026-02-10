-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Immutable wrapper for unaccent to allow indexing
-- Using 'unaccent' dictionary explicitly to ensure immutability
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text AS
$func$
SELECT public.unaccent('public.unaccent', $1)
$func$  LANGUAGE sql IMMUTABLE;

-- Create search function using the immutable wrapper
CREATE OR REPLACE FUNCTION search_perfumes_unaccent(
  search_query TEXT,
  result_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  release_year INT,
  brand_name TEXT,
  concentration_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.release_year,
    p.brand_name,
    p.concentration_name
  FROM perfumes_public p
  WHERE 
    f_unaccent(p.name) ILIKE '%' || f_unaccent(search_query) || '%'
    OR f_unaccent(p.brand_name) ILIKE '%' || f_unaccent(search_query) || '%'
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Index Perfumes Name
CREATE INDEX IF NOT EXISTS idx_perfumes_name_trgm 
  ON perfumes USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_perfumes_name_unaccent_trgm
  ON perfumes USING gin (f_unaccent(name) gin_trgm_ops);

-- Index Brands Name
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm 
  ON brands USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_brands_name_unaccent_trgm
  ON brands USING gin (f_unaccent(name) gin_trgm_ops);

GRANT EXECUTE ON FUNCTION search_perfumes_unaccent(TEXT, INT) TO anon, authenticated;
