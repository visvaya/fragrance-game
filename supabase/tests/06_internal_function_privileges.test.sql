-- pgTAP: internal SECURITY DEFINER functions are not callable by client roles.
BEGIN;
SELECT plan(16);

SELECT ok(NOT has_function_privilege('anon', 'public.delete_auth_session(uuid)', 'EXECUTE'), 'anon cannot delete auth sessions');
SELECT ok(NOT has_function_privilege('authenticated', 'public.delete_auth_session(uuid)', 'EXECUTE'), 'authenticated cannot delete auth sessions');
SELECT ok(has_function_privilege('service_role', 'public.delete_auth_session(uuid)', 'EXECUTE'), 'service_role can delete auth sessions');

SELECT ok(NOT has_function_privilege('anon', 'public.refresh_autocomplete_cache()', 'EXECUTE'), 'anon cannot refresh the autocomplete cache');
SELECT ok(NOT has_function_privilege('authenticated', 'public.refresh_autocomplete_cache()', 'EXECUTE'), 'authenticated cannot refresh the autocomplete cache');
SELECT ok(has_function_privilege('service_role', 'public.refresh_autocomplete_cache()', 'EXECUTE'), 'service_role can refresh the autocomplete cache');

SELECT ok(NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'), 'anon cannot call handle_new_user');
SELECT ok(NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'), 'authenticated cannot call handle_new_user');
SELECT ok(NOT has_function_privilege('anon', 'public.auto_create_player()', 'EXECUTE'), 'anon cannot call auto_create_player');
SELECT ok(NOT has_function_privilege('authenticated', 'public.auto_create_player()', 'EXECUTE'), 'authenticated cannot call auto_create_player');
SELECT ok(NOT has_function_privilege('anon', 'public.handle_new_session()', 'EXECUTE'), 'anon cannot call handle_new_session');
SELECT ok(NOT has_function_privilege('authenticated', 'public.handle_new_session()', 'EXECUTE'), 'authenticated cannot call handle_new_session');
SELECT ok(NOT has_function_privilege('anon', 'public.handle_session_update()', 'EXECUTE'), 'anon cannot call handle_session_update');
SELECT ok(NOT has_function_privilege('authenticated', 'public.handle_session_update()', 'EXECUTE'), 'authenticated cannot call handle_session_update');
SELECT ok(NOT has_function_privilege('anon', 'public.handle_session_delete()', 'EXECUTE'), 'anon cannot call handle_session_delete');
SELECT ok(NOT has_function_privilege('authenticated', 'public.handle_session_delete()', 'EXECUTE'), 'authenticated cannot call handle_session_delete');

SELECT * FROM finish();
ROLLBACK;
