-- Runs the Supabase database linter (splinter.sql, the lints behind the Supabase advisors) on a
-- database built from the migrations (CI job "Database from migrations"). The job downloads
-- splinter.sql at a pinned commit, checks its SHA-256 and passes its path as the psql variable
-- `splinter`; scripts/db-lint.ts judges the CSV output against supabase/checks/splinter-exceptions.json.
-- The schemas exposed through the Data API are those of [api].schemas in supabase/config.toml.
BEGIN;
SET LOCAL pgrst.db_schemas = 'public, extensions, storage, graphql_public';
\i :splinter
ROLLBACK;
