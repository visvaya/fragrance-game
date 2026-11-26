-- pgTAP: flankers the source named like their base perfume carry their variant word again
-- (migration 20261126010000_restore_lost_variant_words). The listed keys are the old names of
-- rows in the production catalogue; a database built from the seed has none of them either.
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
    WHERE source_record_slug IN (
      'azzaro-azzaro pour homme-eau de toilette-1992',
      'chanel-coco mademoiselle-eau de parfum-2018',
      'yves saint laurent-libre-eau de parfum-2020',
      'givenchy-l''interdit-eau de parfum-2021',
      'kenzo-kenzo world-eau de parfum-2017'
    )
  ),
  0,
  'no flanker keeps the name of its base perfume'
);

SELECT * FROM finish();
ROLLBACK;
