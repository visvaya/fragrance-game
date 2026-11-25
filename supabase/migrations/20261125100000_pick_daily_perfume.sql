-- Pick the perfume of a new daily challenge in the database.
--
-- The generate-daily cron fetched the candidate pool through PostgREST and drew one row in
-- JavaScript, but a PostgREST response stops at 1000 rows, so with a larger pool some perfumes
-- could never be drawn. This function draws one eligible perfume at random from the whole pool
-- and returns its difficulty score, which the cron stores with the challenge.
--
-- Eligible, as the cron filtered before: a row in perfume_assets with the first image, not
-- uncertain, active, with a difficulty score (the game cannot load a puzzle without it) and with
-- top notes (linear perfumes keep their flat list there), and not used by a challenge dated on or
-- after exclude_since (future dates included). The cron passes the date 30 days back and, when
-- that leaves no perfume, 7 days back.
--
-- Only the cron calls it, with the service role; client roles get no EXECUTE.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE FUNCTION public.pick_daily_perfume(exclude_since date)
 RETURNS TABLE(perfume_id uuid, xsolve_score double precision)
 LANGUAGE sql
 VOLATILE SECURITY INVOKER
 SET search_path TO ''
AS $function$
  SELECT p.id, p.xsolve_score
  FROM public.perfume_assets AS pa
  JOIN public.perfumes AS p ON p.id = pa.perfume_id
  WHERE pa.image_key_step_1 IS NOT NULL
    AND p.is_uncertain = false
    AND p.is_active = true
    AND p.xsolve_score IS NOT NULL
    AND p.top_notes <> '{}'
    AND NOT EXISTS (
      SELECT 1 FROM public.daily_challenges AS dc
      WHERE dc.perfume_id = p.id AND dc.challenge_date >= exclude_since
    )
  ORDER BY random()
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.pick_daily_perfume(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pick_daily_perfume(date) TO service_role;
