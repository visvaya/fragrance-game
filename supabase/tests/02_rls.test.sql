-- pgTAP: Row Level Security Tests
-- Run: supabase test db
--
-- Verifies that RLS is enabled on tables, correct policies exist,
-- anon role cannot bypass VIEW protections, and client roles hold only the
-- table privileges they need.

BEGIN;
SELECT plan(66);

-- ============================================================
-- RLS ENABLED — core game tables
-- ============================================================

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'perfumes'),
  'RLS is enabled on perfumes table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_challenges'),
  'RLS is enabled on daily_challenges table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_sessions'),
  'RLS is enabled on game_sessions table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_results'),
  'RLS is enabled on game_results table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'player_streaks'),
  'RLS is enabled on player_streaks table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'brands'),
  'RLS is enabled on brands table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'concentrations'),
  'RLS is enabled on concentrations table'
);

-- ============================================================
-- RLS ENABLED — catalogue tables
-- ============================================================

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notes'),
  'RLS is enabled on notes table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'perfume_notes'),
  'RLS is enabled on perfume_notes table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'perfumers'),
  'RLS is enabled on perfumers table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'perfume_perfumers'),
  'RLS is enabled on perfume_perfumers table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'manufacturers'),
  'RLS is enabled on manufacturers table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'perfume_assets'),
  'RLS is enabled on perfume_assets table'
);

-- ============================================================
-- RLS ENABLED — player account tables
-- ============================================================

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'players'),
  'RLS is enabled on players table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'player_auth_links'),
  'RLS is enabled on player_auth_links table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'player_profiles'),
  'RLS is enabled on player_profiles table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recovery_keys'),
  'RLS is enabled on recovery_keys table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_sessions'),
  'RLS is enabled on user_sessions table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'streak_freezes'),
  'RLS is enabled on streak_freezes table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teams'),
  'RLS is enabled on teams table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'seasons'),
  'RLS is enabled on seasons table'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_admins'),
  'RLS is enabled on app_admins table'
);

-- ============================================================
-- RLS POLICIES — core game
-- Note: uses pg_policies directly to avoid pgTAP version compatibility issues
-- ============================================================

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_sessions' AND policyname='Owner read sessions'),
  'game_sessions has owner-only read policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_results' AND policyname='Owner read results'),
  'game_results has owner-only read policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='player_streaks' AND policyname='Owner read streaks'),
  'player_streaks has owner-only read policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='brands' AND policyname='Public read brands'),
  'brands has public read policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='concentrations' AND policyname='Public read concentrations'),
  'concentrations has public read policy'
);

-- ============================================================
-- RLS POLICIES — player account
-- ============================================================

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='player_auth_links' AND policyname='Owner read auth links'),
  'player_auth_links has owner-only read policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='player_auth_links' AND policyname='Owner delete auth links'),
  'player_auth_links has owner-only delete policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='player_auth_links' AND policyname='Service role all auth links'),
  'player_auth_links has service_role policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='player_profiles' AND policyname='Owner read player_profiles'),
  'player_profiles has owner-only read policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='player_profiles' AND policyname='Owner update player_profiles'),
  'player_profiles has owner-only update policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='player_profiles' AND policyname='Owner insert player_profiles'),
  'player_profiles has owner insert policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_sessions' AND policyname='Users can view own sessions'),
  'user_sessions has owner-only read policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_sessions' AND policyname='Users can update own sessions'),
  'user_sessions has owner-only update policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_sessions' AND policyname='Users can insert own sessions'),
  'user_sessions has insert policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recovery_keys' AND policyname='Owner read recovery keys'),
  'recovery_keys has owner-only read policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recovery_keys' AND policyname='Service role all recovery keys'),
  'recovery_keys has service_role policy'
);

SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_admins' AND policyname='Service role only app_admins'),
  'app_admins restricted to service_role only'
);

-- ============================================================
-- SECURITY INVOKER on views (critical — prevents RLS bypass)
-- ============================================================
-- SECURITY INVOKER means queries execute as calling user, not view owner.
-- SECURITY DEFINER would bypass RLS, exposing all rows to anon.

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_views
    WHERE viewname = 'perfumes_public' AND schemaname = 'public'
  ),
  'perfumes_public view exists in pg_views'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_views
    WHERE viewname = 'daily_challenges_public' AND schemaname = 'public'
  ),
  'daily_challenges_public view exists in pg_views'
);

-- ============================================================
-- anon cannot SELECT directly from protected tables
-- ============================================================

SELECT ok(
  NOT has_table_privilege('anon', 'public.perfumes', 'SELECT'),
  'anon has no direct SELECT on perfumes table (access via VIEW only)'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.daily_challenges', 'SELECT'),
  'anon has no direct SELECT on daily_challenges table (access via VIEW only)'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.game_sessions', 'SELECT'),
  'anon has no direct SELECT on game_sessions table'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.game_results', 'SELECT'),
  'anon has no direct SELECT on game_results table'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.player_streaks', 'SELECT'),
  'anon has no direct SELECT on player_streaks table'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.player_auth_links', 'SELECT'),
  'anon has no direct SELECT on player_auth_links table'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.player_profiles', 'SELECT'),
  'anon has no direct SELECT on player_profiles table'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.recovery_keys', 'SELECT'),
  'anon has no direct SELECT on recovery_keys table'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.user_sessions', 'SELECT'),
  'anon has no direct SELECT on user_sessions table'
);

-- ============================================================
-- anon CAN SELECT from public views
-- ============================================================

SELECT ok(
  has_table_privilege('anon', 'public.perfumes_public', 'SELECT'),
  'anon can SELECT from perfumes_public view'
);

SELECT ok(
  has_table_privilege('anon', 'public.daily_challenges_public', 'SELECT'),
  'anon can SELECT from daily_challenges_public view'
);

-- ============================================================
-- service_role CAN access everything
-- ============================================================

SELECT ok(
  has_table_privilege('service_role', 'public.perfumes', 'SELECT'),
  'service_role can SELECT from perfumes table directly'
);

SELECT ok(
  has_table_privilege('service_role', 'public.daily_challenges', 'SELECT'),
  'service_role can SELECT from daily_challenges table directly'
);

-- ============================================================
-- Players cannot read image keys or delete their own game state
-- ============================================================

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.perfume_assets', 'SELECT'),
  'authenticated (incl. anonymous players) cannot SELECT perfume_assets'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.perfume_assets', 'SELECT'),
  'anon cannot SELECT perfume_assets'
);

SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('game_sessions', 'game_results')
      AND cmd IN ('DELETE', 'ALL')
  ),
  'game_sessions and game_results have no DELETE policy'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.game_sessions', 'DELETE')
    AND NOT has_table_privilege('authenticated', 'public.game_results', 'DELETE'),
  'authenticated cannot DELETE game_sessions or game_results'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.players', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.players', 'SELECT'),
  'player ids cannot be listed by client roles'
);

-- ============================================================
-- Game state is written only by the server (service role)
-- ============================================================

SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('game_sessions', 'game_results', 'player_streaks')
      AND cmd IN ('INSERT', 'UPDATE', 'ALL')
  ),
  'game_sessions, game_results and player_streaks have no INSERT or UPDATE policy'
);

SELECT is(
  (SELECT count(*)::int
     FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
     CROSS JOIN (VALUES ('public.game_sessions'), ('public.game_results'),
                        ('public.player_streaks')) AS t(table_name)
    WHERE has_any_column_privilege(r.role_name, t.table_name, 'INSERT')),
  0,
  'client roles cannot INSERT into any column of the game state tables'
);

SELECT is(
  (SELECT count(*)::int
     FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
     CROSS JOIN (VALUES ('public.game_sessions'), ('public.game_results'),
                        ('public.player_streaks')) AS t(table_name)
    WHERE has_any_column_privilege(r.role_name, t.table_name, 'UPDATE')),
  0,
  'client roles cannot UPDATE any column of the game state tables'
);

SELECT is(
  (SELECT count(*)::int
     FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
     CROSS JOIN (VALUES ('public.game_sessions'), ('public.game_results'),
                        ('public.player_streaks')) AS t(table_name)
     CROSS JOIN (VALUES ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(privilege)
    WHERE has_table_privilege(r.role_name, t.table_name, p.privilege)),
  0,
  'client roles hold no DELETE, TRUNCATE, REFERENCES or TRIGGER on the game state tables'
);

SELECT ok(
  CASE WHEN current_setting('server_version_num')::int < 170000 THEN true
       ELSE NOT EXISTS (
         SELECT 1 FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
         CROSS JOIN (VALUES ('public.game_sessions'), ('public.game_results'),
                            ('public.player_streaks')) AS t(table_name)
         WHERE has_table_privilege(r.role_name, t.table_name, 'MAINTAIN'))
  END,
  'client roles hold no MAINTAIN on the game state tables (PostgreSQL 17+)'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.game_sessions', 'SELECT')
    AND has_table_privilege('authenticated', 'public.game_results', 'SELECT'),
  'authenticated keeps SELECT on its own game rows (server actions read them under RLS)'
);

SELECT ok(
  has_table_privilege('service_role', 'public.game_sessions', 'INSERT')
    AND has_table_privilege('service_role', 'public.game_sessions', 'UPDATE')
    AND has_table_privilege('service_role', 'public.game_results', 'INSERT'),
  'service_role can write game_sessions and game_results'
);

SELECT * FROM finish();
ROLLBACK;
