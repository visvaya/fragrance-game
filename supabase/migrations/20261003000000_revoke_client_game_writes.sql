-- Game state is written only by server actions with the service role (2026-10-03).
--
-- Players (anonymous ones included, role authenticated) could insert and update their own
-- game_sessions rows and insert game_results rows through the REST API: reset
-- attempts_count, forge guess feedback (which also bypassed the server-side clue
-- masking), start a fresh session for the same puzzle, or record any score. The
-- INSERT/UPDATE policies never existed in migrations; they were created by hand.
-- Server actions now write these tables with the service role and pass the verified
-- player id explicitly. Client roles keep SELECT on their own rows only.
--
-- player_streaks has no client write policy, but the table-level grants were still in
-- place; they are revoked so a future policy cannot open writes by accident.
-- Revoking a table-level privilege also revokes it on every column.

DROP POLICY IF EXISTS "Owner insert sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Owner update sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Players can insert their own results" ON public.game_results;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.game_sessions, public.game_results, public.player_streaks
  FROM anon, authenticated;
