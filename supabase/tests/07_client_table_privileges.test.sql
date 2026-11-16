-- pgTAP: client roles cannot bypass RLS with table-level maintenance privileges, write no public
-- table, and no function that runs arbitrary SQL is reachable through the REST API schema.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(9);

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

-- Every write goes through the server (service_role) or a SECURITY DEFINER trigger.
SELECT is(
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role_name)
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
     AND (has_any_column_privilege(r.role_name, c.oid, 'INSERT') OR has_any_column_privilege(r.role_name, c.oid, 'UPDATE')
       OR has_table_privilege(r.role_name, c.oid, 'DELETE'))),
  0,
  'client roles cannot insert, update or delete in any public table or view'
);

SELECT is(
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role_name)
   WHERE n.nspname = 'public' AND c.relkind = 'S'
     AND (has_sequence_privilege(r.role_name, c.oid, 'USAGE') OR has_sequence_privilege(r.role_name, c.oid, 'UPDATE'))),
  0,
  'client roles cannot take or set values of any public sequence'
);

SELECT is(
  (SELECT count(*)::int FROM pg_default_acl d, aclexplode(d.defaclacl) a
   WHERE (d.defaclnamespace = 0 OR d.defaclnamespace = 'public'::regnamespace)
     AND d.defaclrole = 'postgres'::regrole
     AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
     AND ((d.defaclobjtype = 'r' AND a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
       OR (d.defaclobjtype = 'S' AND a.privilege_type IN ('USAGE', 'UPDATE')))),
  0,
  'new tables and sequences created by postgres do not grant client roles write privileges'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     AND roles && ARRAY['public', 'anon', 'authenticated']::name[]),
  0,
  'no public table has an INSERT, UPDATE, DELETE or ALL policy for client roles'
);

SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('lives_ok', 'throws_ok', 'performs_ok', 'results_eq')),
  0,
  'test functions that execute SQL are not in the public schema'
);

SELECT * FROM finish();
ROLLBACK;
