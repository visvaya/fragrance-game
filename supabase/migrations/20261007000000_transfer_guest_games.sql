-- Guest merge in one transaction, callable only by the server (service role).
-- Replaces a sequence of REST calls that could stop half way and that trusted a guest id
-- sent by the browser; the server now passes the id from a signed cookie.

CREATE OR REPLACE FUNCTION public.guest_merge_preview(p_guest_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH today AS (
    SELECT dc.id
    FROM public.daily_challenges dc
    WHERE dc.challenge_date = (now() AT TIME ZONE 'utc')::date
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'guest_games', (
      SELECT count(*) FROM public.game_sessions s
      WHERE s.player_id = p_guest_id AND s.attempts_count > 0
    ),
    'today_moves', EXISTS (
      SELECT 1 FROM public.game_sessions s, today t
      WHERE s.player_id = p_guest_id AND s.challenge_id = t.id AND s.attempts_count > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.game_sessions a
          WHERE a.player_id = p_account_id AND a.challenge_id = t.id AND a.attempts_count > 0
        )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.transfer_guest_games(p_guest_id uuid, p_account_id uuid, p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today uuid;
  v_moved integer;
  v_guest public.player_streaks%ROWTYPE;
  v_account public.player_streaks%ROWTYPE;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('merge', 'today_only') THEN
    RAISE EXCEPTION 'invalid transfer mode' USING ERRCODE = '22023';
  END IF;
  IF p_guest_id IS NULL OR p_account_id IS NULL OR p_guest_id = p_account_id THEN
    RAISE EXCEPTION 'invalid transfer players' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_guest_id AND u.is_anonymous) THEN
    RAISE EXCEPTION 'source is not a guest account' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_account_id AND NOT u.is_anonymous) THEN
    RAISE EXCEPTION 'target is not a registered account' USING ERRCODE = '22023';
  END IF;

  -- Lock the players rows that exist (a guest may have none). Correctness of concurrent calls
  -- does not rest on this lock: the statements below lock the session rows they change, and the
  -- unique (player_id, challenge_id) constraint rejects a duplicate, so a second call either waits
  -- and then finds nothing to move or fails as a whole.
  PERFORM 1 FROM public.players p
  WHERE p.id IN (p_guest_id, p_account_id)
  ORDER BY p.id
  FOR UPDATE;

  SELECT dc.id INTO v_today
  FROM public.daily_challenges dc
  WHERE dc.challenge_date = (now() AT TIME ZONE 'utc')::date
  LIMIT 1;

  -- A session "has moves" when attempts_count > 0 (the column is nullable; NULL means none).
  -- Results go with their sessions (ON DELETE CASCADE); a session without moves has no result.

  -- 1. A guest game with moves replaces an account session without moves (for example one the
  --    page created on the first render after sign-in). Under READ COMMITTED the WHERE clause is
  --    re-checked on a row changed concurrently, so a session that just got its first move stays.
  DELETE FROM public.game_sessions a
  WHERE a.player_id = p_account_id
    AND COALESCE(a.attempts_count, 0) = 0
    AND (p_mode = 'merge' OR a.challenge_id = v_today)
    AND a.challenge_id IN (
      SELECT g.challenge_id FROM public.game_sessions g
      WHERE g.player_id = p_guest_id AND g.attempts_count > 0
    );

  -- 2. Otherwise the account's game wins: it has moves, or both sessions are empty.
  DELETE FROM public.game_sessions s
  WHERE s.player_id = p_guest_id
    AND (p_mode = 'merge' OR s.challenge_id = v_today)
    AND s.challenge_id IN (
      SELECT a.challenge_id FROM public.game_sessions a WHERE a.player_id = p_account_id
    );

  -- 3. Guest sessions without moves carry nothing worth keeping.
  DELETE FROM public.game_sessions s
  WHERE s.player_id = p_guest_id
    AND COALESCE(s.attempts_count, 0) = 0
    AND (p_mode = 'merge' OR s.challenge_id = v_today);

  -- 4. Move the rest.
  UPDATE public.game_sessions s
  SET player_id = p_account_id,
      metadata = COALESCE(s.metadata, '{}'::jsonb) || '{"started_as_guest": true}'::jsonb
  WHERE s.player_id = p_guest_id
    AND (p_mode = 'merge' OR s.challenge_id = v_today);
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  UPDATE public.game_results r
  SET player_id = p_account_id,
      is_ranked = false,
      ranked_reason = 'started_as_guest'
  WHERE r.player_id = p_guest_id
    AND (p_mode = 'merge' OR r.challenge_id = v_today);

  IF p_mode = 'merge' THEN
    SELECT * INTO v_guest FROM public.player_streaks ps WHERE ps.player_id = p_guest_id FOR UPDATE;
    IF FOUND THEN
      SELECT * INTO v_account FROM public.player_streaks ps WHERE ps.player_id = p_account_id FOR UPDATE;
      IF FOUND THEN
        UPDATE public.player_streaks ps
        SET best_streak = GREATEST(v_guest.best_streak, v_account.best_streak),
            current_streak = CASE WHEN v_guest.current_streak > v_account.current_streak
              THEN v_guest.current_streak ELSE v_account.current_streak END,
            jokers_remaining = CASE WHEN v_guest.current_streak > v_account.current_streak
              THEN v_guest.jokers_remaining ELSE v_account.jokers_remaining END,
            last_played_date = CASE WHEN v_guest.current_streak > v_account.current_streak
              THEN v_guest.last_played_date ELSE v_account.last_played_date END,
            updated_at = now()
        WHERE ps.player_id = p_account_id;
        DELETE FROM public.player_streaks ps WHERE ps.player_id = p_guest_id;
      ELSE
        UPDATE public.player_streaks ps SET player_id = p_account_id, updated_at = now()
        WHERE ps.player_id = p_guest_id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('moved_sessions', v_moved);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guest_merge_preview(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_guest_games(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_merge_preview(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_guest_games(uuid, uuid, text) TO service_role;
