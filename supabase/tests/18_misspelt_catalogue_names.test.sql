-- pgTAP: names the source misspells are corrected (migration
-- 20261126050000_fix_misspelt_catalogue_names; the ETL applies the same fixes on import).
-- Non-ASCII characters are built with chr() so the file stays ASCII.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(2);

SELECT is(
  (SELECT count(*)::int FROM brands WHERE name = 'Est' || chr(275) || 'e Lauder'),
  0,
  'Estee Lauder is spelt with an e with an acute accent'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM perfumes
    WHERE name ~ (
      'Est' || chr(275) || 'e|Azur' || chr(275) || 'e|Olymp' || chr(275) || 'a|M' || chr(275)
      || 't' || chr(257) || 'l|P' || chr(275) || 'trole|^25:43:00$'
    )
  ),
  0,
  'no perfume name keeps a misspelling the source makes'
);

SELECT * FROM finish();
ROLLBACK;
