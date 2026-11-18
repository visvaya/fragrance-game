-- Index the seven foreign keys that had no covering index (Supabase performance advisor,
-- unindexed_foreign_keys, 2026-11-18). Without one, a delete on the referenced table, including
-- the ON DELETE CASCADE from players, and a join on the key scan the whole referencing table.
--
-- The largest table here is perfumes (about 59 thousand rows, 62 MB), so a plain CREATE INDEX
-- inside the migration transaction takes seconds; the timeouts stop it instead of letting it wait
-- behind a long lock. supabase/tests/12_foreign_key_indexes.test.sql keeps every future foreign key
-- covered.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE INDEX idx_daily_challenges_perfume_id ON public.daily_challenges USING btree (perfume_id);
CREATE INDEX idx_game_results_challenge_id ON public.game_results USING btree (challenge_id);
CREATE INDEX idx_import_conflicts_import_run_id ON public.import_conflicts USING btree (import_run_id);
CREATE INDEX idx_import_conflicts_raw_row_id ON public.import_conflicts USING btree (raw_row_id);
CREATE INDEX idx_perfumes_manufacturer_id ON public.perfumes USING btree (manufacturer_id);
CREATE INDEX idx_player_auth_links_player_id ON public.player_auth_links USING btree (player_id);
CREATE INDEX idx_raw_import_rows_import_run_id ON public.raw_import_rows USING btree (import_run_id);
