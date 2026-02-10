-- ============================================
-- Migration: Fix Public View to include Brand Name (Fixed Schema)
-- DATE: 2026-01-20
-- ============================================

-- Drop old view first
DROP VIEW IF EXISTS perfumes_public;

-- Recreate view with JOIN to brands
CREATE OR REPLACE VIEW perfumes_public AS
SELECT
    p.id,
    p.brand_id,
    b.name AS brand_name,
    p.name,
    p.unique_slug,
    p.release_year,
    p.concentration_id,
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
WHERE p.is_active = true;

-- Permissions
GRANT SELECT ON perfumes_public TO anon, authenticated;
