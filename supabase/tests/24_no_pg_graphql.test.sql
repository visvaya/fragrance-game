-- pgTAP: the GraphQL extension is not installed, as on production
-- (migration 20261127000000_drop_pg_graphql).
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(1);

SELECT is(
  (SELECT count(*)::int FROM pg_extension WHERE extname = 'pg_graphql'),
  0,
  'pg_graphql is not installed, so no table is exposed through GraphQL'
);

SELECT * FROM finish();
ROLLBACK;
