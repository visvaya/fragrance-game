-- pgTAP: catalogue names hold no UTF-8 text decoded as CP1250 (a lead character such as U+0102
-- followed by a Latin-1, Latin Extended or punctuation character) and no "SeeByChloe" spelling.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(6);

CREATE TEMP TABLE mojibake ON COMMIT DROP AS
SELECT
  '[' || chr(258) || chr(195) || chr(196) || chr(313) || chr(197) || chr(226) || ']'
  || '[' || chr(128) || '-' || chr(767) || chr(8192) || '-' || chr(8447) || ']' AS pattern;

SELECT is(
  (SELECT count(*)::int FROM concentrations, mojibake WHERE name ~ pattern), 0,
  'concentration names have no broken encoding'
);
SELECT is(
  (SELECT count(*)::int FROM brands, mojibake WHERE name ~ pattern), 0,
  'brand names have no broken encoding'
);
SELECT is(
  (SELECT count(*)::int FROM manufacturers, mojibake WHERE name ~ pattern), 0,
  'manufacturer names have no broken encoding'
);
SELECT is(
  (SELECT count(*)::int FROM perfumes, mojibake WHERE name ~ pattern), 0,
  'perfume names have no broken encoding'
);
SELECT is(
  (SELECT count(*)::int FROM perfumes WHERE name LIKE 'SeeByChlo%'), 0,
  'no perfume is named SeeByChloe'
);
SELECT is(
  (SELECT count(*)::int FROM perfume_autocomplete_cache WHERE name LIKE 'SeeByChlo%'), 0,
  'autocomplete offers no SeeByChloe name'
);

SELECT * FROM finish();
ROLLBACK;
