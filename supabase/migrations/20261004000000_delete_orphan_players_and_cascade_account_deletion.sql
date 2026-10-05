-- Game data follows the account that owns it.
--
-- A players row is created by a trigger when an auth user is created and shares its id,
-- but nothing removes it when the auth user is deleted. Deleted accounts (in practice
-- throwaway accounts from automated browser tests) therefore left players, sessions and
-- results behind, and those rows count in statistics. Anonymous accounts that were merged
-- into a signed-in account keep their auth user, so they are not affected.
--
-- 1. Results are deleted with their player and with their session.
-- 2. Delete players whose auth user no longer exists; the cascades remove their sessions
--    and results, including results that point to such a session under another player_id.
-- 3. players.id references auth.users, so deleting an account deletes its game data.
--
-- The file runs in one explicit transaction, so the locks below hold until COMMIT.

BEGIN;

-- Keep a concurrent account deletion from creating a new orphan between the cleanup and
-- the new foreign key. Both tables stay locked until COMMIT, so sign-ups, sign-ins that
-- update auth.users and account deletions wait for the few milliseconds the migration takes.
LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.players IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.game_results
  DROP CONSTRAINT game_results_player_id_fkey,
  ADD CONSTRAINT game_results_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES public.players (id) ON DELETE CASCADE;

ALTER TABLE public.game_results
  DROP CONSTRAINT game_results_session_id_fkey,
  ADD CONSTRAINT game_results_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.game_sessions (id) ON DELETE CASCADE;

DELETE FROM public.players AS p
WHERE NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p.id);

ALTER TABLE public.players
  ADD CONSTRAINT players_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

COMMIT;
