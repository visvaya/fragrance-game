-- Local development seed file.
-- Runs AFTER all migrations via config.toml [db.seed].
--
-- PURPOSE: Match cloud Supabase extension schema layout.
--
-- Cloud Supabase installs extensions in the `extensions` schema.
-- Local Supabase installs them in `public` by default (via CREATE EXTENSION in migrations).
-- Migrations reference extensions.similarity(), extensions.dmetaphone() etc.
-- Without moving extensions to the `extensions` schema, these calls fail locally.
--
-- This file also installs fuzzystrmatch (provides dmetaphone) which is enabled
-- on cloud via the dashboard but has no CREATE EXTENSION migration.

-- Ensure extensions schema exists.
CREATE SCHEMA IF NOT EXISTS extensions;

-- Install fuzzystrmatch (not in any migration — enabled via dashboard on cloud).
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch SCHEMA extensions;

-- Move extensions from public → extensions schema to match cloud layout.
-- IF NOT EXISTS check: if extension is already in extensions schema (re-seed), skip.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION unaccent SET SCHEMA extensions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
END $$;
