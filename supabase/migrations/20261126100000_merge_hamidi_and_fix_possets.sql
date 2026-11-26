-- Merge the brand "Hamidi" into its current name and give the Possets perfume "3:5:8" its name.
--
-- Owner review 2026-11-26: "Hamidi Oud & Perfumes" is the current name of the brand the source also
-- lists as "Hamidi", so autocomplete showed one brand twice. Its 20 perfumes move to the current
-- brand (none collides with a perfume already there, none is certain, none has been a daily puzzle;
-- checked on production), and the empty brand row goes. The Possets name "3:5:8" was read as the
-- time "03:05:08". The ETL applies both on import (scripts/etl.py, BRAND_RENAMES and NAME_FIXES).

-- The view refresh takes an exclusive lock on perfume_autocomplete_cache (about 59 000 rows):
-- give up rather than queue behind a long reader, and bound the whole migration.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

UPDATE public.perfumes
SET name = '3:5:8'
WHERE source_record_slug = 'possets-03:05:08-unknown-2013';

UPDATE public.perfumes AS p
SET brand_id = current_brand.id
FROM public.brands AS former_brand, public.brands AS current_brand
WHERE former_brand.name = 'Hamidi'
  AND current_brand.name = 'Hamidi Oud & Perfumes'
  AND p.brand_id = former_brand.id;

DELETE FROM public.brands AS b
WHERE b.name = 'Hamidi'
  AND NOT EXISTS (SELECT 1 FROM public.perfumes AS p WHERE p.brand_id = b.id);

-- Autocomplete reads brand and perfume names from this view.
REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
