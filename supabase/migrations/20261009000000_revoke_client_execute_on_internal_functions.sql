-- Internal SECURITY DEFINER functions are callable only by the server.
--
-- PostgreSQL grants EXECUTE on new functions to PUBLIC, and the client roles held
-- their own grants as well, so anyone with the public API key could call these through
-- /rest/v1/rpc and run them with the owner's privileges:
-- - delete_auth_session(uuid) deletes any auth session whose id the caller knows; the app
--   calls it only with the service role after checking that the session belongs to the user;
-- - refresh_autocomplete_cache() refreshes a materialized view; nothing in the app calls it,
--   and repeated calls load the database;
-- - the five trigger functions run only as triggers. Trigger firing does not check EXECUTE,
--   so revoking it does not change account creation or session tracking.
--
-- Intentionally unchanged: search_perfumes_unaccent_v2 (autocomplete calls it with the
-- user's client) and f_unaccent (a pure helper used in index expressions and by the search).

REVOKE EXECUTE ON FUNCTION public.delete_auth_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_autocomplete_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_create_player() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_session() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_session_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_session_delete() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.delete_auth_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_autocomplete_cache() TO service_role;
