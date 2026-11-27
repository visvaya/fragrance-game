-- Production has no pg_graphql extension (only the graphql_public placeholder function), but the
-- Postgres image that local stacks and CI start with installs it. Dropping it here makes a
-- database built from the migrations match production, so the schema linter stops reporting
-- tables "exposed in the GraphQL schema" that production does not serve. On production this is
-- a no-op; afterwards the platform's event trigger keeps the same placeholder function.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- No client uses GraphQL and production never had the extension's objects.
-- squawk-ignore ban-drop-extension
DROP EXTENSION IF EXISTS pg_graphql;
