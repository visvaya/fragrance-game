-- Index the result's session so that deleting a session (and an account, which cascades
-- through its sessions) finds the session's results without scanning the table.

CREATE INDEX IF NOT EXISTS idx_game_results_session_id ON public.game_results (session_id);
