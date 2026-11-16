-- Client roles lose direct access to the search objects. The autocomplete server action calls the
-- search with the service role after its user check and rate limit; with EXECUTE granted to anon,
-- a direct /rest/v1/rpc call skipped both. f_unaccent and the autocomplete cache are used only
-- inside the search and index expressions. Found by the Supabase linter (splinter) on 2026-11-16:
-- anon/authenticated_security_definer_function_executable and materialized_view_in_api.
REVOKE EXECUTE ON FUNCTION public.search_perfumes_unaccent_v2(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_unaccent(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.perfume_autocomplete_cache FROM PUBLIC, anon, authenticated;

-- auth.uid() inside a subquery is evaluated once per query instead of once per row
-- (splinter auth_rls_initplan).
DROP POLICY "Users can view own sessions" ON public.user_sessions;
CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
