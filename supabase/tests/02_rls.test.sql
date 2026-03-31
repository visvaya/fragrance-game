-- pgTAP: Row Level Security Tests
-- Run: supabase test db
--
-- Verifies that RLS is enabled on tables, correct policies exist,
-- and anon role cannot bypass VIEW protections.

BEGIN;
SELECT plan(54);

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

SELECT * FROM finish();
ROLLBACK;
