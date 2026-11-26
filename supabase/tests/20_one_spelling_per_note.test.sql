-- pgTAP: one spelling per note and perfumer (migration 20261126070000_one_spelling_per_note_and_perfumer;
-- the ETL applies the same spellings on import).
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(2);

SELECT is(
  (
    SELECT count(*)::int
    FROM perfumes
    WHERE 'Waterlily' = ANY (
      coalesce(top_notes, '{}') || coalesce(middle_notes, '{}') || coalesce(base_notes, '{}')
    )
  ),
  0,
  'water lily has one spelling'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM perfumes
    WHERE perfumers && ARRAY['Nathalie Lawson', 'Nelly Hachem Ruiz']
  ),
  0,
  'perfumer names have one spelling'
);

SELECT * FROM finish();
ROLLBACK;
