-- ============================================
-- Migration: M1 Public Views (Column-Level Security)
-- ============================================

-- 1. Daily Challenges Public View
-- Only expose safe metadata. Exclude perfume_id, seed_hash.
CREATE OR REPLACE VIEW daily_challenges_public AS
SELECT
    id,
    challenge_date,
    mode,
    grace_deadline_at_utc,
    snapshot_metadata
FROM daily_challenges;

-- Permissions: Block direct table access, allow view access
REVOKE SELECT ON daily_challenges FROM anon, authenticated;
GRANT SELECT ON daily_challenges_public TO anon, authenticated;


-- 2. Perfumes Public View
-- Exclude internal ETL fields (xsolve, fingerprints)
CREATE OR REPLACE VIEW perfumes_public AS
SELECT
    id,
    brand_id,
    name,
    unique_slug,
    release_year,
    concentration_id,
    gender,
    image_url,
    rating_value,
    rating_count,
    manufacturer_id,
    origin_url,
    is_uncertain,
    is_linear,
    main_accords,
    games_played,
    solve_rate
FROM perfumes
WHERE is_active = true;

-- Permissions
REVOKE SELECT ON perfumes FROM anon, authenticated;
GRANT SELECT ON perfumes_public TO anon, authenticated;

-- Ensure Brands/Concentrations are readable (Reference tables with no sensitive data)
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read brands" ON brands FOR SELECT USING (true);
GRANT SELECT ON brands TO anon, authenticated;

ALTER TABLE concentrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read concentrations" ON concentrations FOR SELECT USING (true);
GRANT SELECT ON concentrations TO anon, authenticated;
