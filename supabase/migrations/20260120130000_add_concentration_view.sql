-- ============================================
-- Migration: Add Concentration Name to Public View
-- DATE: 2026-01-20
-- ============================================

-- Drop old view first
DROP VIEW IF EXISTS perfumes_public;

-- Recreate view with JOIN to brands AND concentrations
CREATE OR REPLACE VIEW perfumes_public AS
SELECT
    p.id,
    p.brand_id,
    b.name AS brand_name,
    p.name,
    p.unique_slug,
    p.release_year,
    p.concentration_id,
    c.name AS concentration_name, -- Added column
    p.gender,
    p.manufacturer_id,
    p.is_uncertain,
    p.is_linear,
    p.games_played,
    p.solve_rate,
    p.top_notes,
    p.middle_notes,
    p.base_notes
FROM perfumes p
JOIN brands b ON p.brand_id = b.id
LEFT JOIN concentrations c ON p.concentration_id = c.id -- LEFT JOIN as concentration might be null
WHERE p.is_active = true;

-- Permissions
GRANT SELECT ON perfumes_public TO anon, authenticated;
