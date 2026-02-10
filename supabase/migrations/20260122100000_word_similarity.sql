-- Drop old function
DROP FUNCTION IF EXISTS search_perfumes_unaccent(text, integer);

-- Create new word_similarity-based function
CREATE OR REPLACE FUNCTION search_perfumes_unaccent(
  search_query text,
  limit_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  brand_id uuid,
  brand_name text,
  year integer,
  gender text,
  concentration text,
  similarity_score real
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.brand_id,
    b.name as brand_name,
    p.release_year as year,
    p.gender,
    c.name as concentration, -- Joined from concentrations table
    word_similarity(search_query, f_unaccent(p.name || ' ' || b.name)) as similarity_score
  FROM perfumes p
  JOIN brands b ON p.brand_id = b.id
  LEFT JOIN concentrations c ON p.concentration_id = c.id
  WHERE 
    word_similarity(search_query, f_unaccent(p.name || ' ' || b.name)) > 0.2
  ORDER BY similarity_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE INDEX IF NOT EXISTS idx_perfumes_word_sim 
  ON perfumes USING gin (f_unaccent(name) gin_trgm_ops);
