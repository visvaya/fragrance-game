-- Close client access gaps found on production (2026-10-01).
--
-- 1. perfume_assets: every authenticated role (anonymous players included) could
--    read all image keys through the REST API, including later reveal steps of
--    today's puzzle. Server actions and the cron read it with the service role.
-- 2. game_sessions / game_results: DELETE policies created by hand while
--    debugging let players delete today's session and replay it. They never
--    existed in migrations; the debug reset now runs with the service role.
-- 3. players: "Public read players" let anyone list every player id, which made
--    anonymous accounts enumerable for the account-merge action. No client code
--    reads or writes players; rows are created by SECURITY DEFINER triggers.

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.perfume_assets;
REVOKE ALL ON public.perfume_assets FROM anon, authenticated;

DROP POLICY IF EXISTS "Owner delete sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Players can delete their own results" ON public.game_results;
REVOKE DELETE ON public.game_sessions FROM anon, authenticated;
REVOKE DELETE ON public.game_results FROM anon, authenticated;

DROP POLICY IF EXISTS "Public read players" ON public.players;
DROP POLICY IF EXISTS "Owner update players" ON public.players;
REVOKE ALL ON public.players FROM anon, authenticated;
