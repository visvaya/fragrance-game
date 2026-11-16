-- Client roles (anon, authenticated) write no table in public: game state, sessions and every
-- other write go through the server with the service role, and user_sessions is written only by
-- the SECURITY DEFINER triggers on auth.sessions. Until now the client roles held INSERT, UPDATE
-- and DELETE on most tables, limited only by RLS, and a few RLS policies let a player insert or
-- change their own rows (user_sessions included). This removes those write paths; SELECT grants
-- and SELECT policies stay as they are.

REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
-- Client roles insert nothing, so they never take values from a sequence.
REVOKE USAGE, UPDATE ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- The same for objects that postgres creates in public later.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, UPDATE ON SEQUENCES FROM anon, authenticated;

-- Write policies for client roles have no grant left to act on.
DROP POLICY "Users can insert own sessions" ON public.user_sessions;
DROP POLICY "Users can update own sessions" ON public.user_sessions;
DROP POLICY "Owner insert player_profiles" ON public.player_profiles;
DROP POLICY "Owner update player_profiles" ON public.player_profiles;
DROP POLICY "Owner insert streak_freezes" ON public.streak_freezes;
DROP POLICY "Owner delete auth links" ON public.player_auth_links;
