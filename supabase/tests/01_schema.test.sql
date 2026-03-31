-- pgTAP: Schema Structure Tests
-- Run: supabase test db
--
-- Verifies that all critical tables, views, functions, and indexes exist
-- with the correct structure. Does NOT test data or permissions.

BEGIN;
SELECT plan(58);

-- ============================================================
-- TABLES — core game
-- ============================================================

SELECT has_table('public', 'perfumes',           'perfumes table exists');
SELECT has_table('public', 'brands',             'brands table exists');
SELECT has_table('public', 'concentrations',     'concentrations table exists');
SELECT has_table('public', 'notes',              'notes table exists');
SELECT has_table('public', 'perfume_notes',      'perfume_notes table exists');
SELECT has_table('public', 'daily_challenges',   'daily_challenges table exists');
SELECT has_table('public', 'game_sessions',      'game_sessions table exists');
SELECT has_table('public', 'game_results',       'game_results table exists');
SELECT has_table('public', 'players',            'players table exists');
SELECT has_table('public', 'player_streaks',     'player_streaks table exists');

-- ============================================================
-- TABLES — catalogue
-- ============================================================

SELECT has_table('public', 'manufacturers',      'manufacturers table exists');
SELECT has_table('public', 'perfumers',          'perfumers table exists');
SELECT has_table('public', 'perfume_perfumers',  'perfume_perfumers table exists');
SELECT has_table('public', 'perfume_assets',     'perfume_assets table exists');

-- ============================================================
-- TABLES — player account & social
-- ============================================================

SELECT has_table('public', 'player_auth_links',  'player_auth_links table exists');
SELECT has_table('public', 'player_profiles',    'player_profiles table exists');
SELECT has_table('public', 'recovery_keys',      'recovery_keys table exists');
SELECT has_table('public', 'user_sessions',      'user_sessions table exists');
SELECT has_table('public', 'streak_freezes',     'streak_freezes table exists');
SELECT has_table('public', 'teams',              'teams table exists');
SELECT has_table('public', 'seasons',            'seasons table exists');
SELECT has_table('public', 'app_admins',         'app_admins table exists');

-- ============================================================
-- VIEWS
-- ============================================================

SELECT has_view('public', 'perfumes_public',           'perfumes_public view exists');
SELECT has_view('public', 'daily_challenges_public',   'daily_challenges_public view exists');

-- ============================================================
-- MATERIALIZED VIEWS
-- ============================================================

SELECT ok(
  EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'perfume_autocomplete_cache'),
  'perfume_autocomplete_cache materialized view exists'
);

-- ============================================================
-- perfumes_public — must NOT expose sensitive columns
-- ============================================================

SELECT hasnt_column('public', 'perfumes_public', 'top_notes',
  'perfumes_public excludes top_notes (fragrance notes are clues — leaked before reveal)');

SELECT hasnt_column('public', 'perfumes_public', 'middle_notes',
  'perfumes_public excludes middle_notes');

SELECT hasnt_column('public', 'perfumes_public', 'base_notes',
  'perfumes_public excludes base_notes');

SELECT hasnt_column('public', 'perfumes_public', 'xsolve_score',
  'perfumes_public excludes xsolve_score (proprietary difficulty algorithm)');

SELECT hasnt_column('public', 'perfumes_public', 'fingerprint_strict',
  'perfumes_public excludes fingerprint_strict (ETL internal field)');

SELECT hasnt_column('public', 'perfumes_public', 'fingerprint_loose',
  'perfumes_public excludes fingerprint_loose');

-- perfumes_public — must expose safe public columns
SELECT has_column('public', 'perfumes_public', 'id',           'perfumes_public has id');
SELECT has_column('public', 'perfumes_public', 'name',         'perfumes_public has name');
SELECT has_column('public', 'perfumes_public', 'gender',       'perfumes_public has gender');
SELECT has_column('public', 'perfumes_public', 'is_uncertain', 'perfumes_public has is_uncertain');

-- ============================================================
-- daily_challenges_public — must NOT expose perfume_id
-- ============================================================

SELECT hasnt_column('public', 'daily_challenges_public', 'perfume_id',
  'daily_challenges_public excludes perfume_id (answer to current challenge)');

SELECT hasnt_column('public', 'daily_challenges_public', 'seed_hash',
  'daily_challenges_public excludes seed_hash');

-- daily_challenges_public — must expose safe columns
SELECT has_column('public', 'daily_challenges_public', 'id',             'daily_challenges_public has id');
SELECT has_column('public', 'daily_challenges_public', 'challenge_date', 'daily_challenges_public has challenge_date');
SELECT has_column('public', 'daily_challenges_public', 'mode',           'daily_challenges_public has mode');

-- ============================================================
-- perfumes TABLE — critical columns and constraints
-- ============================================================

SELECT has_column('public', 'perfumes', 'id',           'perfumes has id');
SELECT has_column('public', 'perfumes', 'brand_id',     'perfumes has brand_id FK');
SELECT has_column('public', 'perfumes', 'name',         'perfumes has name');
SELECT has_column('public', 'perfumes', 'xsolve_score', 'perfumes has xsolve_score');
SELECT has_column('public', 'perfumes', 'is_active',    'perfumes has is_active');
SELECT col_is_pk('public', 'perfumes', 'id',            'perfumes.id is primary key');
SELECT col_not_null('public', 'perfumes', 'name',       'perfumes.name is NOT NULL');

-- ============================================================
-- FUNCTIONS — search
-- ============================================================

SELECT has_function('public', 'search_perfumes_unaccent_v2',
  'search_perfumes_unaccent_v2 function exists');

SELECT has_function('public', 'f_unaccent',
  'f_unaccent function exists');

SELECT has_function('public', 'normalize_search_text',
  'normalize_search_text function exists');

-- ============================================================
-- FUNCTIONS — slug
-- ============================================================

SELECT has_function('public', 'slugify',
  'slugify function exists');

SELECT has_function('public', 'generate_unique_slug',
  'generate_unique_slug trigger function exists');

-- ============================================================
-- FUNCTIONS — session sync triggers
-- ============================================================

SELECT has_function('public', 'handle_new_session',
  'handle_new_session trigger function exists');

SELECT has_function('public', 'handle_session_update',
  'handle_session_update trigger function exists');

SELECT has_function('public', 'handle_session_delete',
  'handle_session_delete trigger function exists');

SELECT has_function('public', 'delete_auth_session',
  'delete_auth_session rpc function exists');

-- ============================================================
-- PUBLIC VIEW ACCESS
-- ============================================================

SELECT has_table_privilege('anon', 'public.perfumes_public', 'SELECT',
  'anon can SELECT from perfumes_public view');

SELECT has_table_privilege('anon', 'public.daily_challenges_public', 'SELECT',
  'anon can SELECT from daily_challenges_public view');

SELECT * FROM finish();
ROLLBACK;
