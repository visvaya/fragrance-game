-- pgTAP: yearly editions get the year their source address holds (migration
-- 20261126060000_year_from_address; the ETL takes the same year on import). The listed keys belong
-- to rows in the production catalogue; a database built from the seed has none of them either.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(1);

SELECT is(
  (
    SELECT count(*)::int
    FROM perfumes
    WHERE release_year IS NULL
      AND source_record_slug IN (
        'rabanne-1 million collector''s edition-unknown-0',
        'rabanne-1 million x pac-man collector edition-unknown-0',
        'carolina herrera-212 splash-unknown-0'
      )
  ),
  0,
  'yearly editions carry the year from their source address'
);

SELECT * FROM finish();
ROLLBACK;
