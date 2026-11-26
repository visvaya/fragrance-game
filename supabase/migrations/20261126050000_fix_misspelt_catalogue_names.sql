-- Fix names the source misspells: an e with a macron for an e with an acute accent, and a time.
--
-- The source writes "Estee Lauder", "Azuree", "Olympea", "Metal" and "Petrole" with an e with a
-- macron (U+0113) where the names have an e with an acute accent (U+00E9), and "Metal" with an a
-- with a macron (U+0101) as well: the brand and 26 perfumes (one certain). A spreadsheet read the
-- Lush name "25:43" as the time "25:43:00". Latvian and other names that really use a macron stay.
-- The ETL now applies the same fixes on import (scripts/etl.py, NAME_FIXES), so the next import
-- matches these rows by their corrected names. No corrected name collides with an existing row
-- (checked on production 2026-11-26).
--
-- Non-ASCII characters are built with chr() so the file stays ASCII.

-- The view refresh takes an exclusive lock on perfume_autocomplete_cache (about 59 000 rows):
-- give up rather than queue behind a long reader, and bound the whole migration.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

UPDATE public.brands
SET name = 'Est' || chr(233) || 'e Lauder'
WHERE name = 'Est' || chr(275) || 'e Lauder';

UPDATE public.perfumes
SET name = replace(replace(replace(replace(replace(replace(name,
  'Est' || chr(275) || 'e', 'Est' || chr(233) || 'e'),
  'Azur' || chr(275) || 'e', 'Azur' || chr(233) || 'e'),
  'Olymp' || chr(275) || 'a', 'Olymp' || chr(233) || 'a'),
  'M' || chr(275) || 't' || chr(257) || 'l', 'M' || chr(233) || 'tal'),
  'P' || chr(275) || 'trole', 'P' || chr(233) || 'trole'),
  '25:43:00', '25:43')
WHERE name ~ (
  'Est' || chr(275) || 'e|Azur' || chr(275) || 'e|Olymp' || chr(275) || 'a|M' || chr(275) || 't'
  || chr(257) || 'l|P' || chr(275) || 'trole|^25:43:00$'
);

-- Autocomplete reads the corrected brand and perfume names from this view.
REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
