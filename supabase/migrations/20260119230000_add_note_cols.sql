-- Migration: Add Note Pyramids and Perfumers columns
-- Date: 2026-01-19
-- Description: Adds TOP/MIDDLE/BASE notes and PERFUMERS arrays to perfumes table.

ALTER TABLE public.perfumes 
ADD COLUMN IF NOT EXISTS top_notes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS middle_notes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS base_notes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS perfumers text[] DEFAULT '{}';

-- Optional: Comment on columns
COMMENT ON COLUMN public.perfumes.top_notes IS 'Cleaned list of top notes';
COMMENT ON COLUMN public.perfumes.middle_notes IS 'Cleaned list of middle/heart notes';
COMMENT ON COLUMN public.perfumes.base_notes IS 'Cleaned list of base notes';
COMMENT ON COLUMN public.perfumes.perfumers IS 'List of perumers (creators)';

-- Update eligible_perfumes view to match the new ETL strategy
-- Now relies on xsolve_score IS NOT NULL instead of rating_count and image_url
CREATE OR REPLACE VIEW public.eligible_perfumes AS
SELECT p.*
FROM public.perfumes p
WHERE p.is_uncertain = FALSE
  AND p.is_active = TRUE
  AND p.xsolve_score IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.daily_challenges dc
      WHERE dc.perfume_id = p.id
      AND dc.challenge_date > CURRENT_DATE - INTERVAL '365 days'
  );

COMMENT ON VIEW public.eligible_perfumes IS 'View of perfumes eligible for Daily Challenges. Filtered by xSolve score and cooldown.';
