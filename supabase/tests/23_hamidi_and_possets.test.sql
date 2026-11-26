-- pgTAP: the brand "Hamidi" is merged into "Hamidi Oud & Perfumes" and no perfume is named
-- "03:05:08" (migration 20261126100000_merge_hamidi_and_fix_possets).
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(2);

SELECT is(
  (SELECT count(*)::int FROM brands WHERE name = 'Hamidi'),
  0,
  'the brand Hamidi is listed under its current name only'
);

SELECT is(
  (SELECT count(*)::int FROM perfumes WHERE name = '03:05:08'),
  0,
  'no perfume name is a time a spreadsheet made of it'
);

SELECT * FROM finish();
ROLLBACK;
