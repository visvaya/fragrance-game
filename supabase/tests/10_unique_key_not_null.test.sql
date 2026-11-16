-- pgTAP: the columns of unique keys are NOT NULL, so the keys hold for every row
-- (supabase/checks/unique-nulls.sql guards new keys on the database built from the migrations).
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(6);

SELECT col_not_null('public', 'game_sessions', 'player_id', 'game_sessions.player_id is NOT NULL');
SELECT col_not_null('public', 'game_sessions', 'challenge_id', 'game_sessions.challenge_id is NOT NULL');
SELECT col_not_null('public', 'game_results', 'player_id', 'game_results.player_id is NOT NULL');
SELECT col_not_null('public', 'game_results', 'challenge_id', 'game_results.challenge_id is NOT NULL');
SELECT col_not_null('public', 'perfume_asset_sources', 'perfume_id', 'perfume_asset_sources.perfume_id is NOT NULL');
SELECT col_not_null('public', 'perfumes', 'unique_slug', 'perfumes.unique_slug is NOT NULL');

SELECT * FROM finish();
ROLLBACK;
