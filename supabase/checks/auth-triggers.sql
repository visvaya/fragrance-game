-- Behaviour of the triggers on auth.users and auth.sessions, for a database built from the
-- migrations (CI job "Database from migrations"). It writes to auth tables, so it must never run
-- against production: it lives outside supabase/tests, which the pgTAP job runs there.
-- Run with psql -v ON_ERROR_STOP=1 as postgres; every check raises an exception on a mismatch and
-- the transaction is rolled back at the end.
BEGIN;

-- Sign-up as the auth server does it: the trigger creates the player and its auth link.
SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.users (id, aud, role, is_anonymous, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true,
        '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00');
RESET ROLE;

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'sign-up did not create the player row';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.player_auth_links
                 WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'
                   AND player_id = '00000000-0000-4000-8000-000000000001' AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'sign-up did not create the auth link';
  END IF;
END
$check$;

-- A new session is mirrored in user_sessions.
SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, user_agent, ip)
VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001',
        '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00', 'agent-1', '192.0.2.1');
RESET ROLE;

DO $check$
DECLARE
  s public.user_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.user_sessions
  WHERE session_token_hash = '00000000-0000-4000-8000-0000000000a1';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a new session did not create a user_sessions row';
  END IF;
  IF s.user_id <> '00000000-0000-4000-8000-000000000001' OR s.ip_address <> '192.0.2.1'::inet
     OR s.device_info ->> 'user_agent' IS DISTINCT FROM 'agent-1'
     OR s.last_active_at <> '2026-01-01 10:00:00+00' OR s.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected user_sessions row after sign-in: %', row_to_json(s);
  END IF;
END
$check$;

-- A token refresh updates the session; the mirror follows.
SET LOCAL ROLE supabase_auth_admin;
UPDATE auth.sessions
SET updated_at = '2026-01-01 11:00:00+00', user_agent = 'agent-2', ip = '192.0.2.2'
WHERE id = '00000000-0000-4000-8000-0000000000a1';
RESET ROLE;

DO $check$
DECLARE
  s public.user_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.user_sessions
  WHERE session_token_hash = '00000000-0000-4000-8000-0000000000a1';
  IF s.ip_address IS DISTINCT FROM '192.0.2.2'::inet
     OR s.device_info ->> 'user_agent' IS DISTINCT FROM 'agent-2'
     OR s.last_active_at IS DISTINCT FROM '2026-01-01 11:00:00+00' OR s.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'user_sessions did not follow the session update: %', row_to_json(s);
  END IF;
END
$check$;

-- Sign-out deletes the session; the mirror is marked revoked, not deleted.
SET LOCAL ROLE supabase_auth_admin;
DELETE FROM auth.sessions WHERE id = '00000000-0000-4000-8000-0000000000a1';
RESET ROLE;

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_sessions
                 WHERE session_token_hash = '00000000-0000-4000-8000-0000000000a1'
                   AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'sign-out did not mark the user_sessions row as revoked';
  END IF;
END
$check$;

-- Deleting the account removes the player and the mirrored sessions.
SET LOCAL ROLE supabase_auth_admin;
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-000000000001';
RESET ROLE;

DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-0000-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM public.player_auth_links WHERE player_id = '00000000-0000-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM public.user_sessions WHERE user_id = '00000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'deleting the account left player or session rows behind';
  END IF;
END
$check$;

ROLLBACK;
