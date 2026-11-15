-- Client roles (anon, authenticated) keep only what the API needs: row access under RLS.
-- TRUNCATE bypasses RLS, MAINTAIN allows LOCK/VACUUM/REINDEX, TRIGGER and REFERENCES are never used
-- by clients. The test framework's functions run arbitrary SQL and stay callable only by postgres
-- (the CI test login is a member of postgres).

revoke truncate, trigger, references, maintain on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;

do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid
    where e.extname = 'pgtap'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to postgres', fn);
  end loop;
end
$$;
