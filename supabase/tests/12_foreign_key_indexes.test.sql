-- pgTAP: every foreign key in public has an index whose leading columns are the key's columns,
-- so deletes on the referenced table (ON DELETE CASCADE from players included) and joins on the
-- key do not scan the whole referencing table.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(1);

SELECT is_empty(
  $$
    SELECT con.conrelid::regclass::text || ' (' || con.conname || ')'
    FROM pg_constraint AS con
    WHERE con.contype = 'f'
      AND con.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index AS idx
        WHERE idx.indrelid = con.conrelid
          AND (idx.indkey::int2[])[0:cardinality(con.conkey) - 1] @> con.conkey
          AND (idx.indkey::int2[])[0:cardinality(con.conkey) - 1] <@ con.conkey
      )
  $$,
  'every foreign key in public has a covering index'
);

SELECT * FROM finish();
ROLLBACK;
