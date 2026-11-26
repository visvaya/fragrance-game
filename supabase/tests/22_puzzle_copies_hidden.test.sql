-- pgTAP: confirmed copies of puzzle-pool perfumes are hidden (migration
-- 20261126090000_hide_puzzle_pool_copies). The listed rows exist in the production catalogue; a
-- database built from the seed has none of them either.
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
    WHERE is_active
      AND source_record_slug IN (
        'maison margiela-replica - jazz club-unknown-2013',
        'dior-dior homme-parfum-2014',
        'rabanne-phantom-unknown-0'
      )
  ),
  0,
  'confirmed copies of puzzle-pool perfumes are hidden'
);

SELECT * FROM finish();
ROLLBACK;
