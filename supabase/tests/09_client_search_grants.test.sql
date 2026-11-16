-- pgTAP: the search function, f_unaccent and the autocomplete cache are not reachable by client
-- roles (the server calls the search with the service role), and the user_sessions policy
-- evaluates auth.uid() once per query.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(8);

SELECT ok(NOT has_function_privilege('anon', 'public.search_perfumes_unaccent_v2(text, integer)', 'EXECUTE'),
  'anon cannot call the search function');
SELECT ok(NOT has_function_privilege('authenticated', 'public.search_perfumes_unaccent_v2(text, integer)', 'EXECUTE'),
  'authenticated cannot call the search function');
SELECT ok(has_function_privilege('service_role', 'public.search_perfumes_unaccent_v2(text, integer)', 'EXECUTE'),
  'the service role can call the search function');
SELECT ok(NOT has_function_privilege('anon', 'public.f_unaccent(text)', 'EXECUTE'),
  'anon cannot call f_unaccent');
SELECT ok(NOT has_function_privilege('authenticated', 'public.f_unaccent(text)', 'EXECUTE'),
  'authenticated cannot call f_unaccent');
SELECT ok(NOT has_table_privilege('anon', 'public.perfume_autocomplete_cache', 'SELECT'),
  'anon cannot read the autocomplete cache');
SELECT ok(NOT has_table_privilege('authenticated', 'public.perfume_autocomplete_cache', 'SELECT'),
  'authenticated cannot read the autocomplete cache');
SELECT matches(
  (SELECT qual FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can view own sessions'),
  'SELECT auth\.uid\(\)',
  'the user_sessions policy reads auth.uid() through a subquery'
);

SELECT * FROM finish();
ROLLBACK;
