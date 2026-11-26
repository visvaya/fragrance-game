-- Use one spelling per note and perfumer.
--
-- Guess feedback compares notes and perfumers between the guessed perfume and the answer, ignoring
-- case only (lib/game/guess-feedback.ts), so "Waterlily" (104 rows) did not match "Water lily"
-- (280). The same holds for two perfumer spellings: "Nathalie Lawson" (1 row) for "Nathalie Lorson"
-- (249), and "Nelly Hachem Ruiz" (16 rows) beside "Nelly Hachem-Ruiz" (the certain row's
-- spelling). Measured on production 2026-11-26; these were the only notes that differ beyond case
-- and accents. The ETL applies the same spellings on import (scripts/etl.py, ITEM_SPELLINGS).

-- About 120 rows change; give up rather than queue behind a long lock, and bound the migration.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- The note renamed in place, keeping the order and the first of any repeated note; NULL stays NULL.
CREATE FUNCTION pg_temp.respell(items text[], wrong text, right_spelling text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN items IS NULL THEN NULL ELSE ARRAY(
    SELECT item
    FROM (
      SELECT item, min(position) AS first_position
      FROM unnest(array_replace(items, wrong, right_spelling)) WITH ORDINALITY AS t (item, position)
      GROUP BY item
    ) AS kept
    ORDER BY first_position
  ) END
$$;

UPDATE public.perfumes
SET
  top_notes = pg_temp.respell(top_notes, 'Waterlily', 'Water lily'),
  middle_notes = pg_temp.respell(middle_notes, 'Waterlily', 'Water lily'),
  base_notes = pg_temp.respell(base_notes, 'Waterlily', 'Water lily')
WHERE 'Waterlily' = ANY (
  coalesce(top_notes, '{}') || coalesce(middle_notes, '{}') || coalesce(base_notes, '{}')
);

UPDATE public.perfumes
SET perfumers = pg_temp.respell(
  pg_temp.respell(perfumers, 'Nathalie Lawson', 'Nathalie Lorson'),
  'Nelly Hachem Ruiz',
  'Nelly Hachem-Ruiz'
)
WHERE perfumers && ARRAY['Nathalie Lawson', 'Nelly Hachem Ruiz'];
