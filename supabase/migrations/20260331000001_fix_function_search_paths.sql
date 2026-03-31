-- Fixes Supabase security advisory: function_search_path_mutable (0011)
-- Without a fixed search_path, an attacker who can create objects in a schema
-- earlier in the search path could intercept calls to these functions.
-- Extensions schema is included because these functions call extensions.unaccent(),
-- extensions.similarity(), extensions.dmetaphone() etc.

ALTER FUNCTION public.f_unaccent(text)
  SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.extensions_f_unaccent(text)
  SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.extensions_dmetaphone(text)
  SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.normalize_search_text(input_text text)
  SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.handle_new_session()
  SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.handle_session_update()
  SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.handle_session_delete()
  SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.delete_auth_session(session_id uuid)
  SET search_path = public, extensions, pg_catalog;

-- debug_autocomplete_data() is exposed via REST API (/rpc/debug_autocomplete_data)
-- without any authorization. It leaks internal autocomplete data structure.
-- Autocomplete works correctly — removing this debug function from production.
DROP FUNCTION IF EXISTS public.debug_autocomplete_data();
