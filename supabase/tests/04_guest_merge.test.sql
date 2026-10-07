-- pgTAP: guest merge functions are server-only.
BEGIN;
SELECT plan(12);

SELECT has_function('public', 'guest_merge_preview', ARRAY['uuid', 'uuid']);
SELECT has_function('public', 'transfer_guest_games', ARRAY['uuid', 'uuid', 'text']);

SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.guest_merge_preview(uuid, uuid)'::regprocedure),
  'guest_merge_preview is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.transfer_guest_games(uuid, uuid, text)'::regprocedure),
  'transfer_guest_games is SECURITY DEFINER');

SELECT ok((SELECT 'search_path=""' = ANY (proconfig) FROM pg_proc WHERE oid = 'public.guest_merge_preview(uuid, uuid)'::regprocedure),
  'guest_merge_preview pins an empty search_path');
SELECT ok((SELECT 'search_path=""' = ANY (proconfig) FROM pg_proc WHERE oid = 'public.transfer_guest_games(uuid, uuid, text)'::regprocedure),
  'transfer_guest_games pins an empty search_path');

SELECT ok(NOT has_function_privilege('anon', 'public.guest_merge_preview(uuid, uuid)', 'EXECUTE'), 'anon cannot preview a merge');
SELECT ok(NOT has_function_privilege('authenticated', 'public.guest_merge_preview(uuid, uuid)', 'EXECUTE'), 'authenticated cannot preview a merge');
SELECT ok(has_function_privilege('service_role', 'public.guest_merge_preview(uuid, uuid)', 'EXECUTE'), 'service_role can preview a merge');
SELECT ok(NOT has_function_privilege('anon', 'public.transfer_guest_games(uuid, uuid, text)', 'EXECUTE'), 'anon cannot transfer games');
SELECT ok(NOT has_function_privilege('authenticated', 'public.transfer_guest_games(uuid, uuid, text)', 'EXECUTE'), 'authenticated cannot transfer games');
SELECT ok(has_function_privilege('service_role', 'public.transfer_guest_games(uuid, uuid, text)', 'EXECUTE'), 'service_role can transfer games');

SELECT * FROM finish();
ROLLBACK;
