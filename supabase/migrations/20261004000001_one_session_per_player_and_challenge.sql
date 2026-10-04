-- One game session per player and puzzle.
--
-- Two first moves sent at the same time could each create a session, and the game resumed
-- the newest one, so a lost game could be replaced by a fresh start. Existing duplicates
-- are removed with this rule: keep the session that has a recorded result; otherwise the
-- finished session that started first; otherwise the session with the most attempts
-- (earliest on a tie). The first real game counts; later ones were replays.
--
-- The file runs in one explicit transaction, so the lock below holds until COMMIT.

BEGIN;

-- Sessions cannot be created while duplicates are removed, and results cannot be recorded
-- for a session while duplicates are removed.
LOCK TABLE public.game_sessions IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.game_results IN SHARE MODE;

WITH ranked AS (
  SELECT
    gs.id,
    row_number() OVER (
      PARTITION BY gs.player_id, gs.challenge_id
      ORDER BY
        EXISTS (SELECT 1 FROM public.game_results AS gr WHERE gr.session_id = gs.id) DESC,
        COALESCE(gs.status IN ('won', 'lost'), false) DESC,
        CASE WHEN gs.status IN ('won', 'lost') THEN NULL ELSE gs.attempts_count END
          DESC NULLS LAST,
        gs.start_time ASC,
        gs.id ASC
    ) AS keep_rank
  FROM public.game_sessions AS gs
)
DELETE FROM public.game_sessions AS gs
USING ranked
WHERE gs.id = ranked.id
  AND ranked.keep_rank > 1;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_player_id_challenge_id_key UNIQUE (player_id, challenge_id);

COMMIT;
