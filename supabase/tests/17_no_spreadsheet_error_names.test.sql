-- pgTAP: no perfume is named after a spreadsheet formula error (migration
-- 20261126040000_restore_spreadsheet_broken_names; the ETL rebuilds such names on import).
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(1);

SELECT is(
  (SELECT count(*)::int FROM perfumes WHERE name IN ('#NAZWA?', '#NAME?')),
  0,
  'no perfume is named #NAZWA? or #NAME?'
);

SELECT * FROM finish();
ROLLBACK;
