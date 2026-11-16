import { z } from "zod";

import { jsonSchema } from "./json.schema";

// Enum Schemas
// Table Schemas
export const AppAdmins = z.object({
  created_at: z.string().nullable(),
  user_id: z.string(),
});
export type AppAdmins = z.infer<typeof AppAdmins>;

export const AppAdminsInsert = z.object({
  created_at: z.string().optional(),
  user_id: z.string(),
});
export type AppAdminsInsert = z.infer<typeof AppAdminsInsert>;

export const AppAdminsUpdate = z.object({
  created_at: z.string().optional(),
  user_id: z.string().optional(),
});
export type AppAdminsUpdate = z.infer<typeof AppAdminsUpdate>;

export const Brands = z.object({
  created_at: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type Brands = z.infer<typeof Brands>;

export const BrandsInsert = z.object({
  created_at: z.string().optional(),
  id: z.string().optional(),
  name: z.string(),
  slug: z.string(),
});
export type BrandsInsert = z.infer<typeof BrandsInsert>;

export const BrandsUpdate = z.object({
  created_at: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
});
export type BrandsUpdate = z.infer<typeof BrandsUpdate>;

export const Concentrations = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type Concentrations = z.infer<typeof Concentrations>;

export const ConcentrationsInsert = z.object({
  id: z.string().optional(),
  name: z.string(),
  slug: z.string(),
});
export type ConcentrationsInsert = z.infer<typeof ConcentrationsInsert>;

export const ConcentrationsUpdate = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
});
export type ConcentrationsUpdate = z.infer<typeof ConcentrationsUpdate>;

export const DailyChallenges = z.object({
  challenge_date: z.string(),
  challenge_number: z.number(),
  created_at: z.string().nullable(),
  grace_deadline_at_utc: z.string(),
  id: z.string(),
  mode: z.string().nullable(),
  perfume_id: z.string(),
  seed_hash: z.string(),
  snapshot_metadata: jsonSchema,
  snapshot_schema_version: z.number(),
});
export type DailyChallenges = z.infer<typeof DailyChallenges>;

export const DailyChallengesInsert = z.object({
  challenge_date: z.string(),
  challenge_number: z.number().optional(),
  created_at: z.string().optional(),
  grace_deadline_at_utc: z.string(),
  id: z.string().optional(),
  mode: z.string().optional(),
  perfume_id: z.string(),
  seed_hash: z.string(),
  snapshot_metadata: jsonSchema,
  snapshot_schema_version: z.number().optional(),
});
export type DailyChallengesInsert = z.infer<typeof DailyChallengesInsert>;

export const DailyChallengesUpdate = z.object({
  challenge_date: z.string().optional(),
  challenge_number: z.number().optional(),
  created_at: z.string().optional(),
  grace_deadline_at_utc: z.string().optional(),
  id: z.string().optional(),
  mode: z.string().optional(),
  perfume_id: z.string().optional(),
  seed_hash: z.string().optional(),
  snapshot_metadata: jsonSchema.optional(),
  snapshot_schema_version: z.number().optional(),
});
export type DailyChallengesUpdate = z.infer<typeof DailyChallengesUpdate>;

export const GameResults = z.object({
  attempts: z.number(),
  challenge_id: z.string(),
  completed_at: z.string().nullable(),
  id: z.string(),
  is_ranked: z.boolean(),
  player_id: z.string(),
  ranked_reason: z.string().nullable(),
  score: z.number(),
  score_raw: z.number(),
  scoring_version: z.number(),
  session_id: z.string().nullable(),
  status: z.string().nullable(),
  time_seconds: z.number(),
});
export type GameResults = z.infer<typeof GameResults>;

export const GameResultsInsert = z.object({
  attempts: z.number(),
  challenge_id: z.string(),
  completed_at: z.string().optional(),
  id: z.string().optional(),
  is_ranked: z.boolean().optional(),
  player_id: z.string(),
  ranked_reason: z.string().optional(),
  score: z.number(),
  score_raw: z.number().optional(),
  scoring_version: z.number().optional(),
  session_id: z.string().optional(),
  status: z.string().optional(),
  time_seconds: z.number(),
});
export type GameResultsInsert = z.infer<typeof GameResultsInsert>;

export const GameResultsUpdate = z.object({
  attempts: z.number().optional(),
  challenge_id: z.string().optional(),
  completed_at: z.string().optional(),
  id: z.string().optional(),
  is_ranked: z.boolean().optional(),
  player_id: z.string().optional(),
  ranked_reason: z.string().optional(),
  score: z.number().optional(),
  score_raw: z.number().optional(),
  scoring_version: z.number().optional(),
  session_id: z.string().optional(),
  status: z.string().optional(),
  time_seconds: z.number().optional(),
});
export type GameResultsUpdate = z.infer<typeof GameResultsUpdate>;

export const GameSessions = z.object({
  attempts_count: z.number().nullable(),
  challenge_id: z.string(),
  guesses: jsonSchema.nullable(),
  id: z.string(),
  last_guess: z.string().nullable(),
  last_nonce: z.string().nullable(),
  metadata: jsonSchema.nullable(),
  player_id: z.string(),
  start_time: z.string().nullable(),
  status: z.string().nullable(),
});
export type GameSessions = z.infer<typeof GameSessions>;

export const GameSessionsInsert = z.object({
  attempts_count: z.number().optional(),
  challenge_id: z.string(),
  guesses: jsonSchema.optional(),
  id: z.string().optional(),
  last_guess: z.string().optional(),
  last_nonce: z.string().optional(),
  metadata: jsonSchema.optional(),
  player_id: z.string(),
  start_time: z.string().optional(),
  status: z.string().optional(),
});
export type GameSessionsInsert = z.infer<typeof GameSessionsInsert>;

export const GameSessionsUpdate = z.object({
  attempts_count: z.number().optional(),
  challenge_id: z.string().optional(),
  guesses: jsonSchema.optional(),
  id: z.string().optional(),
  last_guess: z.string().optional(),
  last_nonce: z.string().optional(),
  metadata: jsonSchema.optional(),
  player_id: z.string().optional(),
  start_time: z.string().optional(),
  status: z.string().optional(),
});
export type GameSessionsUpdate = z.infer<typeof GameSessionsUpdate>;

export const ImportConflicts = z.object({
  conflict_type: z.string(),
  details: jsonSchema.nullable(),
  id: z.string(),
  import_run_id: z.string(),
  raw_row_id: z.string(),
  resolved: z.boolean().nullable(),
});
export type ImportConflicts = z.infer<typeof ImportConflicts>;

export const ImportConflictsInsert = z.object({
  conflict_type: z.string(),
  details: jsonSchema.optional(),
  id: z.string().optional(),
  import_run_id: z.string(),
  raw_row_id: z.string(),
  resolved: z.boolean().optional(),
});
export type ImportConflictsInsert = z.infer<typeof ImportConflictsInsert>;

export const ImportConflictsUpdate = z.object({
  conflict_type: z.string().optional(),
  details: jsonSchema.optional(),
  id: z.string().optional(),
  import_run_id: z.string().optional(),
  raw_row_id: z.string().optional(),
  resolved: z.boolean().optional(),
});
export type ImportConflictsUpdate = z.infer<typeof ImportConflictsUpdate>;

export const ImportRuns = z.object({
  catalog_version: z.string(),
  created_at: z.string(),
  id: z.string(),
});
export type ImportRuns = z.infer<typeof ImportRuns>;

export const ImportRunsInsert = z.object({
  catalog_version: z.string(),
  created_at: z.string().optional(),
  id: z.string().optional(),
});
export type ImportRunsInsert = z.infer<typeof ImportRunsInsert>;

export const ImportRunsUpdate = z.object({
  catalog_version: z.string().optional(),
  created_at: z.string().optional(),
  id: z.string().optional(),
});
export type ImportRunsUpdate = z.infer<typeof ImportRunsUpdate>;

export const Manufacturers = z.object({
  id: z.string(),
  name: z.string(),
});
export type Manufacturers = z.infer<typeof Manufacturers>;

export const ManufacturersInsert = z.object({
  id: z.string().optional(),
  name: z.string(),
});
export type ManufacturersInsert = z.infer<typeof ManufacturersInsert>;

export const ManufacturersUpdate = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});
export type ManufacturersUpdate = z.infer<typeof ManufacturersUpdate>;

export const PerfumeAssetSources = z.object({
  id: z.string(),
  license_status: z.string().nullable(),
  original_filename: z.string().nullable(),
  perfume_id: z.string(),
  scraped_at: z.string().nullable(),
  source_type: z.string(),
  source_url: z.string(),
  takedown_status: z.string().nullable(),
  version: z.number(),
});
export type PerfumeAssetSources = z.infer<typeof PerfumeAssetSources>;

export const PerfumeAssetSourcesInsert = z.object({
  id: z.string().optional(),
  license_status: z.string().optional(),
  original_filename: z.string().optional(),
  perfume_id: z.string(),
  scraped_at: z.string().optional(),
  source_type: z.string().optional(),
  source_url: z.string(),
  takedown_status: z.string().optional(),
  version: z.number().optional(),
});
export type PerfumeAssetSourcesInsert = z.infer<
  typeof PerfumeAssetSourcesInsert
>;

export const PerfumeAssetSourcesUpdate = z.object({
  id: z.string().optional(),
  license_status: z.string().optional(),
  original_filename: z.string().optional(),
  perfume_id: z.string().optional(),
  scraped_at: z.string().optional(),
  source_type: z.string().optional(),
  source_url: z.string().optional(),
  takedown_status: z.string().optional(),
  version: z.number().optional(),
});
export type PerfumeAssetSourcesUpdate = z.infer<
  typeof PerfumeAssetSourcesUpdate
>;

export const PerfumeAssets = z.object({
  asset_random_id: z.string(),
  created_at: z.string().nullable(),
  image_key_step_1: z.string(),
  image_key_step_2: z.string(),
  image_key_step_3: z.string(),
  image_key_step_4: z.string(),
  image_key_step_5: z.string(),
  image_key_step_6: z.string(),
  perfume_id: z.string(),
  updated_at: z.string().nullable(),
});
export type PerfumeAssets = z.infer<typeof PerfumeAssets>;

export const PerfumeAssetsInsert = z.object({
  asset_random_id: z.string(),
  created_at: z.string().optional(),
  image_key_step_1: z.string(),
  image_key_step_2: z.string(),
  image_key_step_3: z.string(),
  image_key_step_4: z.string(),
  image_key_step_5: z.string(),
  image_key_step_6: z.string(),
  perfume_id: z.string(),
  updated_at: z.string().optional(),
});
export type PerfumeAssetsInsert = z.infer<typeof PerfumeAssetsInsert>;

export const PerfumeAssetsUpdate = z.object({
  asset_random_id: z.string().optional(),
  created_at: z.string().optional(),
  image_key_step_1: z.string().optional(),
  image_key_step_2: z.string().optional(),
  image_key_step_3: z.string().optional(),
  image_key_step_4: z.string().optional(),
  image_key_step_5: z.string().optional(),
  image_key_step_6: z.string().optional(),
  perfume_id: z.string().optional(),
  updated_at: z.string().optional(),
});
export type PerfumeAssetsUpdate = z.infer<typeof PerfumeAssetsUpdate>;

export const Perfumes = z.object({
  base_notes: z.array(z.string()).nullable(),
  brand_id: z.string(),
  concentration_id: z.string().nullable(),
  created_at: z.string().nullable(),
  fingerprint_loose: z.string().nullable(),
  fingerprint_strict: z.string().nullable(),
  games_played: z.number(),
  gender: z.string().nullable(),
  id: z.string(),
  is_active: z.boolean().nullable(),
  is_linear: z.boolean().nullable(),
  is_uncertain: z.boolean().nullable(),
  manufacturer_id: z.string().nullable(),
  middle_notes: z.array(z.string()).nullable(),
  name: z.string(),
  perfumers: z.array(z.string()).nullable(),
  release_year: z.number().nullable(),
  solve_rate: z.number().nullable(),
  source_record_slug: z.string(),
  top_notes: z.array(z.string()).nullable(),
  unique_slug: z.string(),
  xsolve_model_version: z.number().nullable(),
  xsolve_score: z.number().nullable(),
});
export type Perfumes = z.infer<typeof Perfumes>;

export const PerfumesInsert = z.object({
  base_notes: z.array(z.string()).optional(),
  brand_id: z.string(),
  concentration_id: z.string().optional(),
  created_at: z.string().optional(),
  fingerprint_loose: z.string().optional(),
  fingerprint_strict: z.string().optional(),
  games_played: z.number().optional(),
  gender: z.string().optional(),
  id: z.string().optional(),
  is_active: z.boolean().optional(),
  is_linear: z.boolean().optional(),
  is_uncertain: z.boolean().optional(),
  manufacturer_id: z.string().optional(),
  middle_notes: z.array(z.string()).optional(),
  name: z.string(),
  perfumers: z.array(z.string()).optional(),
  release_year: z.number().optional(),
  solve_rate: z.number().optional(),
  source_record_slug: z.string(),
  top_notes: z.array(z.string()).optional(),
  unique_slug: z.string(),
  xsolve_model_version: z.number().optional(),
  xsolve_score: z.number().optional(),
});
export type PerfumesInsert = z.infer<typeof PerfumesInsert>;

export const PerfumesUpdate = z.object({
  base_notes: z.array(z.string()).optional(),
  brand_id: z.string().optional(),
  concentration_id: z.string().optional(),
  created_at: z.string().optional(),
  fingerprint_loose: z.string().optional(),
  fingerprint_strict: z.string().optional(),
  games_played: z.number().optional(),
  gender: z.string().optional(),
  id: z.string().optional(),
  is_active: z.boolean().optional(),
  is_linear: z.boolean().optional(),
  is_uncertain: z.boolean().optional(),
  manufacturer_id: z.string().optional(),
  middle_notes: z.array(z.string()).optional(),
  name: z.string().optional(),
  perfumers: z.array(z.string()).optional(),
  release_year: z.number().optional(),
  solve_rate: z.number().optional(),
  source_record_slug: z.string().optional(),
  top_notes: z.array(z.string()).optional(),
  unique_slug: z.string().optional(),
  xsolve_model_version: z.number().optional(),
  xsolve_score: z.number().optional(),
});
export type PerfumesUpdate = z.infer<typeof PerfumesUpdate>;

export const PlayerAuthLinks = z.object({
  auth_user_id: z.string(),
  linked_at: z.string(),
  player_id: z.string(),
  revoked_at: z.string().nullable(),
});
export type PlayerAuthLinks = z.infer<typeof PlayerAuthLinks>;

export const PlayerAuthLinksInsert = z.object({
  auth_user_id: z.string(),
  linked_at: z.string().optional(),
  player_id: z.string(),
  revoked_at: z.string().optional(),
});
export type PlayerAuthLinksInsert = z.infer<typeof PlayerAuthLinksInsert>;

export const PlayerAuthLinksUpdate = z.object({
  auth_user_id: z.string().optional(),
  linked_at: z.string().optional(),
  player_id: z.string().optional(),
  revoked_at: z.string().optional(),
});
export type PlayerAuthLinksUpdate = z.infer<typeof PlayerAuthLinksUpdate>;

export const PlayerStreaks = z.object({
  best_streak: z.number(),
  current_streak: z.number(),
  joker_used_date: z.string().nullable(),
  jokers_remaining: z.number(),
  last_played_date: z.string().nullable(),
  player_id: z.string(),
  updated_at: z.string().nullable(),
});
export type PlayerStreaks = z.infer<typeof PlayerStreaks>;

export const PlayerStreaksInsert = z.object({
  best_streak: z.number().optional(),
  current_streak: z.number().optional(),
  joker_used_date: z.string().optional(),
  jokers_remaining: z.number().optional(),
  last_played_date: z.string().optional(),
  player_id: z.string(),
  updated_at: z.string().optional(),
});
export type PlayerStreaksInsert = z.infer<typeof PlayerStreaksInsert>;

export const PlayerStreaksUpdate = z.object({
  best_streak: z.number().optional(),
  current_streak: z.number().optional(),
  joker_used_date: z.string().optional(),
  jokers_remaining: z.number().optional(),
  last_played_date: z.string().optional(),
  player_id: z.string().optional(),
  updated_at: z.string().optional(),
});
export type PlayerStreaksUpdate = z.infer<typeof PlayerStreaksUpdate>;

export const Players = z.object({
  created_at: z.string(),
  id: z.string(),
  last_seen_at: z.string().nullable(),
});
export type Players = z.infer<typeof Players>;

export const PlayersInsert = z.object({
  created_at: z.string().optional(),
  id: z.string().optional(),
  last_seen_at: z.string().optional(),
});
export type PlayersInsert = z.infer<typeof PlayersInsert>;

export const PlayersUpdate = z.object({
  created_at: z.string().optional(),
  id: z.string().optional(),
  last_seen_at: z.string().optional(),
});
export type PlayersUpdate = z.infer<typeof PlayersUpdate>;

export const RawImportRows = z.object({
  brand_raw: z.string().nullable(),
  concentration_raw: z.string().nullable(),
  created_at: z.string(),
  fp_loose: z.string(),
  fp_strict: z.string(),
  id: z.string(),
  import_run_id: z.string(),
  name_raw: z.string().nullable(),
  raw_json: jsonSchema.nullable(),
  release_year: z.number().nullable(),
});
export type RawImportRows = z.infer<typeof RawImportRows>;

export const RawImportRowsInsert = z.object({
  brand_raw: z.string().optional(),
  concentration_raw: z.string().optional(),
  created_at: z.string().optional(),
  fp_loose: z.string(),
  fp_strict: z.string(),
  id: z.string().optional(),
  import_run_id: z.string(),
  name_raw: z.string().optional(),
  raw_json: jsonSchema.optional(),
  release_year: z.number().optional(),
});
export type RawImportRowsInsert = z.infer<typeof RawImportRowsInsert>;

export const RawImportRowsUpdate = z.object({
  brand_raw: z.string().optional(),
  concentration_raw: z.string().optional(),
  created_at: z.string().optional(),
  fp_loose: z.string().optional(),
  fp_strict: z.string().optional(),
  id: z.string().optional(),
  import_run_id: z.string().optional(),
  name_raw: z.string().optional(),
  raw_json: jsonSchema.optional(),
  release_year: z.number().optional(),
});
export type RawImportRowsUpdate = z.infer<typeof RawImportRowsUpdate>;

export const UserSessions = z.object({
  created_at: z.string().nullable(),
  device_info: jsonSchema.nullable(),
  id: z.string(),
  ip_address: jsonSchema,
  last_active_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  session_token_hash: z.string().nullable(),
  user_id: z.string(),
});
export type UserSessions = z.infer<typeof UserSessions>;

export const UserSessionsInsert = z.object({
  created_at: z.string().optional(),
  device_info: jsonSchema.optional(),
  id: z.string().optional(),
  ip_address: jsonSchema.optional(),
  last_active_at: z.string().optional(),
  revoked_at: z.string().optional(),
  session_token_hash: z.string().optional(),
  user_id: z.string(),
});
export type UserSessionsInsert = z.infer<typeof UserSessionsInsert>;

export const UserSessionsUpdate = z.object({
  created_at: z.string().optional(),
  device_info: jsonSchema.optional(),
  id: z.string().optional(),
  ip_address: jsonSchema.optional(),
  last_active_at: z.string().optional(),
  revoked_at: z.string().optional(),
  session_token_hash: z.string().optional(),
  user_id: z.string().optional(),
});
export type UserSessionsUpdate = z.infer<typeof UserSessionsUpdate>;
