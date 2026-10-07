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
    'guest_games', (SELECT count(*) FROM public.game_sessions s WHERE s.player_id = p_guest_id),
    'today_moves', EXISTS (
      SELECT 1 FROM public.game_sessions s, today t
      WHERE s.player_id = p_guest_id AND s.challenge_id = t.id
        AND NOT EXISTS (
          SELECT 1 FROM public.game_sessions a
          WHERE a.player_id = p_account_id AND a.challenge_id = t.id
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

  -- Serialize concurrent merges of the same pair; the second call finds nothing to move.
  PERFORM 1 FROM public.players p
  WHERE p.id IN (p_guest_id, p_account_id)
  ORDER BY p.id
  FOR UPDATE;

  SELECT dc.id INTO v_today
  FROM public.daily_challenges dc
  WHERE dc.challenge_date = (now() AT TIME ZONE 'utc')::date
  LIMIT 1;

  -- The account's own game wins; results go with their sessions (ON DELETE CASCADE).
  DELETE FROM public.game_sessions s
  WHERE s.player_id = p_guest_id
    AND (p_mode = 'merge' OR s.challenge_id = v_today)
    AND s.challenge_id IN (
      SELECT a.challenge_id FROM public.game_sessions a WHERE a.player_id = p_account_id
    );

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
