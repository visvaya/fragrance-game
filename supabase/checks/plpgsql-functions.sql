-- Static check of every PL/pgSQL function in the public schema with plpgsql_check, for a database
-- built from the migrations (CI job "Database from migrations"). It finds what PostgreSQL reports
-- only when a function runs: a missing table, column or function, a wrong type, an unqualified
-- extension call. Trigger functions are checked against a table they are attached to.
-- The session search_path is empty, so a function without its own SET search_path is checked as
-- if the caller's path held nothing, and an unqualified name resolves only through the function's
-- own SET search_path. Run with psql -v ON_ERROR_STOP=1 as a superuser (locally supabase_admin);
-- errors raise an exception, warnings are printed, and the transaction is rolled back at the end.
BEGIN;

CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA extensions;
SET LOCAL search_path = '';

DO $check$
DECLARE
  fn record;
  finding record;
  errors text[] := '{}';
  warnings integer := 0;
  checked integer := 0;
BEGIN
  FOR fn IN
    SELECT p.oid,
           p.oid::regprocedure::text AS name,
           (SELECT t.tgrelid FROM pg_catalog.pg_trigger t WHERE t.tgfoid = p.oid ORDER BY t.oid LIMIT 1) AS relid,
           p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype AS is_trigger
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public' AND l.lanname = 'plpgsql'
    ORDER BY 2
  LOOP
    IF fn.is_trigger AND fn.relid IS NULL THEN
      RAISE NOTICE 'skipped % (trigger function attached to no table)', fn.name;
      CONTINUE;
    END IF;
    checked := checked + 1;
    FOR finding IN
      SELECT c.level, c.lineno, c.message, c.query
      FROM extensions.plpgsql_check_function_tb(
        fn.oid,
        relid => COALESCE(fn.relid, 0),
        fatal_errors => false
      ) c
    LOOP
      IF finding.level = 'error' THEN
        errors := errors || format('%s line %s: %s%s', fn.name, finding.lineno, finding.message,
                                   COALESCE(' [' || finding.query || ']', ''));
      ELSE
        warnings := warnings + 1;
        RAISE NOTICE '% % line %: %', finding.level, fn.name, finding.lineno, finding.message;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'plpgsql_check: % functions, % errors, % warnings',
    checked, COALESCE(array_length(errors, 1), 0), warnings;
  IF checked = 0 THEN
    RAISE EXCEPTION 'plpgsql_check found no PL/pgSQL functions in public; the query is wrong';
  END IF;
  IF array_length(errors, 1) > 0 THEN
    RAISE EXCEPTION E'plpgsql_check found errors:\n%', array_to_string(errors, E'\n');
  END IF;
END
$check$;

ROLLBACK;
