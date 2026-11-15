-- pgTAP: client roles cannot bypass RLS with table-level maintenance privileges, and no function that
-- runs arbitrary SQL is reachable through the REST API schema.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(5);

SELECT is(
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
     AND (has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'))),
  0,
  'client roles cannot truncate any public table'
);

SELECT is(
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'm')
     AND (has_table_privilege('anon', c.oid, 'MAINTAIN') OR has_table_privilege('authenticated', c.oid, 'MAINTAIN'))),
  0,
  'client roles cannot lock, vacuum or reindex any public table'
);

SELECT is(
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
     AND (has_table_privilege('anon', c.oid, 'TRIGGER') OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
       OR has_table_privilege('anon', c.oid, 'REFERENCES') OR has_table_privilege('authenticated', c.oid, 'REFERENCES'))),
  0,
  'client roles cannot create triggers or foreign keys on any public table'
);

SELECT is(
  -- Schema-level defaults for public plus global ones (defaclnamespace = 0), which a schema-level
  -- revoke cannot remove.
  (SELECT count(*)::int FROM pg_default_acl d, aclexplode(d.defaclacl) a
   WHERE (d.defaclnamespace = 0 OR d.defaclnamespace = 'public'::regnamespace)
     AND d.defaclobjtype = 'r' AND d.defaclrole = 'postgres'::regrole
     AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
     AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN')),
  0,
  'new tables created by postgres do not grant client roles TRUNCATE, TRIGGER, REFERENCES or MAINTAIN'
);

SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('lives_ok', 'throws_ok', 'performs_ok', 'results_eq')),
  0,
  'test functions that execute SQL are not in the public schema'
);

SELECT * FROM finish();
ROLLBACK;
