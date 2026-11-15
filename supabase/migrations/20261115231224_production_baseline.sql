-- Production baseline: the whole project schema as it exists in production on 2026-11-15, written
-- from the production catalog. It replaces the earlier migration chain, which could not build an
-- empty database. It builds a new database only: production already has every object, and the
-- guard below stops the file there before it changes anything.
-- supabase/schema-fingerprint.txt holds the production schema fingerprint; CI builds a database
-- from the migrations and compares its fingerprint with that file.

DO $guard$
BEGIN
  IF to_regclass('public.perfumes') IS NOT NULL THEN
    RAISE EXCEPTION 'production_baseline builds an empty database only: public.perfumes already exists';
  END IF;
END
$guard$;

-- Extensions --------------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA extensions;

-- Functions used by tables, indexes and the autocomplete cache ------------------------------------

CREATE OR REPLACE FUNCTION public.slugify(text_input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(text_input, '[^a-zA-Z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
SELECT extensions.unaccent('extensions.unaccent', $1)
$function$;

CREATE OR REPLACE FUNCTION public.normalize_search_text(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  result text;
BEGIN
  -- Remove accents
  result := extensions.unaccent(input_text);
  
  -- Remove special characters
  result := REGEXP_REPLACE(
    result,
    '[°º№™®©′″\.\-_/:;,!?''"""«»()[\]{}|@#$%^&*+=<>~`]',
    '',
    'g'
  );
  
  -- Normalize "No" + digit → "N" + digit (e.g., "No5" → "N5" for "N°5")
  -- \m = word boundary, gi = global case-insensitive
  result := REGEXP_REPLACE(result, '\mno(\d)', 'n\1', 'gi');
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extensions_dmetaphone(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$SELECT extensions.dmetaphone($1)$function$;

CREATE OR REPLACE FUNCTION public.extensions_f_unaccent(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$SELECT public.f_unaccent($1)$function$;

CREATE OR REPLACE FUNCTION public.generate_unique_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    brand_slug TEXT;
    conc_slug TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INT := 1;
BEGIN
    SELECT slug INTO brand_slug FROM brands WHERE id = NEW.brand_id;

    IF NEW.concentration_id IS NOT NULL THEN
        SELECT slug INTO conc_slug FROM concentrations WHERE id = NEW.concentration_id;
    ELSE
        conc_slug := 'unknown';
    END IF;

    base_slug := brand_slug || '_' || slugify(NEW.name) || '_' || conc_slug || '_' || COALESCE(NEW.release_year::TEXT, 'unknown');
    final_slug := base_slug;

    -- Dedup loop
    WHILE EXISTS(SELECT 1 FROM perfumes WHERE unique_slug = final_slug AND id IS DISTINCT FROM NEW.id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '_' || counter;
    END LOOP;

    NEW.unique_slug := final_slug;
    RETURN NEW;
END;
$function$;


-- Tables ------------------------------------------------------------------------------------------

CREATE TABLE public.concentrations (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL,
  CONSTRAINT concentrations_pkey PRIMARY KEY (id),
  CONSTRAINT concentrations_name_key UNIQUE (name),
  CONSTRAINT concentrations_slug_key UNIQUE (slug)
);

CREATE TABLE public.manufacturers (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  CONSTRAINT manufacturers_pkey PRIMARY KEY (id),
  CONSTRAINT manufacturers_name_key UNIQUE (name)
);

CREATE TABLE public.brands (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT brands_pkey PRIMARY KEY (id),
  CONSTRAINT brands_name_key UNIQUE (name),
  CONSTRAINT brands_slug_key UNIQUE (slug)
);

CREATE TABLE public.perfumes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  brand_id uuid NOT NULL,
  name text NOT NULL,
  source_record_slug text NOT NULL,
  unique_slug text,
  release_year integer,
  concentration_id uuid,
  gender text,
  manufacturer_id uuid,
  is_uncertain boolean DEFAULT false,
  is_linear boolean DEFAULT false,
  is_active boolean DEFAULT true,
  games_played integer NOT NULL DEFAULT 0,
  solve_rate double precision,
  xsolve_score double precision DEFAULT 0,
  xsolve_model_version integer DEFAULT 1,
  fingerprint_strict text,
  fingerprint_loose text,
  created_at timestamp with time zone DEFAULT now(),
  top_notes text[] DEFAULT '{}'::text[],
  middle_notes text[] DEFAULT '{}'::text[],
  base_notes text[] DEFAULT '{}'::text[],
  perfumers text[] DEFAULT '{}'::text[],
  CONSTRAINT perfumes_pkey PRIMARY KEY (id),
  CONSTRAINT perfumes_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  CONSTRAINT perfumes_concentration_id_fkey FOREIGN KEY (concentration_id) REFERENCES public.concentrations(id),
  CONSTRAINT perfumes_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id),
  CONSTRAINT perfumes_release_year_check CHECK (((release_year >= 1668) AND ((release_year)::numeric <= (EXTRACT(year FROM now()) + (2)::numeric)))),
  CONSTRAINT perfumes_source_record_slug_key UNIQUE (source_record_slug),
  CONSTRAINT perfumes_unique_slug_key UNIQUE (unique_slug),
  CONSTRAINT unique_perfume UNIQUE NULLS NOT DISTINCT (brand_id, name, concentration_id, release_year),
  CONSTRAINT valid_gender CHECK (((gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Unisex'::text])) OR (gender IS NULL)))
);

CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL,
  display_name text NOT NULL,
  hints text[] DEFAULT '{}'::text[],
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_name_key UNIQUE (name),
  CONSTRAINT notes_slug_key UNIQUE (slug)
);

CREATE TABLE public.perfume_notes (
  perfume_id uuid NOT NULL,
  note_id uuid NOT NULL,
  type text NOT NULL,
  qualifiers text[] DEFAULT '{}'::text[],
  CONSTRAINT perfume_notes_pkey PRIMARY KEY (perfume_id, note_id, type),
  CONSTRAINT perfume_notes_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE,
  CONSTRAINT perfume_notes_perfume_id_fkey FOREIGN KEY (perfume_id) REFERENCES public.perfumes(id) ON DELETE CASCADE,
  CONSTRAINT perfume_notes_type_check CHECK ((type = ANY (ARRAY['top'::text, 'middle'::text, 'base'::text])))
);

CREATE TABLE public.perfumers (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  CONSTRAINT perfumers_pkey PRIMARY KEY (id),
  CONSTRAINT perfumers_name_key UNIQUE (name)
);

CREATE TABLE public.perfume_perfumers (
  perfume_id uuid NOT NULL,
  perfumer_id uuid NOT NULL,
  CONSTRAINT perfume_perfumers_pkey PRIMARY KEY (perfume_id, perfumer_id),
  CONSTRAINT perfume_perfumers_perfume_id_fkey FOREIGN KEY (perfume_id) REFERENCES public.perfumes(id) ON DELETE CASCADE,
  CONSTRAINT perfume_perfumers_perfumer_id_fkey FOREIGN KEY (perfumer_id) REFERENCES public.perfumers(id) ON DELETE CASCADE
);

CREATE TABLE public.import_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  catalog_version text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT import_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.raw_import_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL,
  brand_raw text,
  name_raw text,
  concentration_raw text,
  release_year integer,
  fp_strict text NOT NULL,
  fp_loose text NOT NULL,
  raw_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT raw_import_rows_pkey PRIMARY KEY (id),
  CONSTRAINT raw_import_rows_import_run_id_fkey FOREIGN KEY (import_run_id) REFERENCES public.import_runs(id) ON DELETE CASCADE
);

CREATE TABLE public.import_conflicts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL,
  raw_row_id uuid NOT NULL,
  conflict_type text NOT NULL,
  details jsonb,
  resolved boolean DEFAULT false,
  CONSTRAINT import_conflicts_pkey PRIMARY KEY (id),
  CONSTRAINT import_conflicts_import_run_id_fkey FOREIGN KEY (import_run_id) REFERENCES public.import_runs(id) ON DELETE CASCADE,
  CONSTRAINT import_conflicts_raw_row_id_fkey FOREIGN KEY (raw_row_id) REFERENCES public.raw_import_rows(id) ON DELETE CASCADE
);

CREATE TABLE public.perfume_source_urls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  perfume_id uuid NOT NULL,
  url text NOT NULL,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT perfume_source_urls_pkey PRIMARY KEY (id),
  CONSTRAINT perfume_source_urls_perfume_id_fkey FOREIGN KEY (perfume_id) REFERENCES public.perfumes(id) ON DELETE CASCADE,
  CONSTRAINT perfume_source_urls_perfume_id_url_key UNIQUE (perfume_id, url)
);

CREATE TABLE public.perfume_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  perfume_id uuid NOT NULL,
  import_run_id uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  diff_jsonb jsonb NOT NULL,
  CONSTRAINT perfume_revisions_pkey PRIMARY KEY (id),
  CONSTRAINT perfume_revisions_import_run_id_fkey FOREIGN KEY (import_run_id) REFERENCES public.import_runs(id),
  CONSTRAINT perfume_revisions_perfume_id_fkey FOREIGN KEY (perfume_id) REFERENCES public.perfumes(id) ON DELETE CASCADE
);

CREATE TABLE public.brand_aliases (
  alias_norm text NOT NULL,
  brand_id uuid NOT NULL,
  CONSTRAINT brand_aliases_pkey PRIMARY KEY (alias_norm),
  CONSTRAINT brand_aliases_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE
);

CREATE TABLE public.brand_aliases_etl (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  alias_name text NOT NULL,
  normalized_name text NOT NULL,
  brand_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT brand_aliases_etl_pkey PRIMARY KEY (id),
  CONSTRAINT brand_aliases_etl_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id)
);

CREATE TABLE public.perfume_assets (
  perfume_id uuid NOT NULL,
  asset_random_id text NOT NULL,
  image_key_step_1 text NOT NULL,
  image_key_step_2 text NOT NULL,
  image_key_step_3 text NOT NULL,
  image_key_step_4 text NOT NULL,
  image_key_step_5 text NOT NULL,
  image_key_step_6 text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT perfume_assets_pkey PRIMARY KEY (perfume_id),
  CONSTRAINT perfume_assets_perfume_id_fkey FOREIGN KEY (perfume_id) REFERENCES public.perfumes(id) ON DELETE CASCADE,
  CONSTRAINT perfume_assets_asset_random_id_key UNIQUE (asset_random_id),
  CONSTRAINT perfume_assets_asset_random_id_format CHECK ((asset_random_id ~ '^[0-9a-f]{32}$'::text)),
  -- Written as in the migration that added it: NOT IN keeps the nested form production stores.
  CONSTRAINT perfume_assets_step_keys_distinct CHECK (
    image_key_step_1 NOT IN (image_key_step_2, image_key_step_3, image_key_step_4,
                             image_key_step_5, image_key_step_6)
    AND image_key_step_2 NOT IN (image_key_step_3, image_key_step_4, image_key_step_5,
                                 image_key_step_6)
    AND image_key_step_3 NOT IN (image_key_step_4, image_key_step_5, image_key_step_6)
    AND image_key_step_4 NOT IN (image_key_step_5, image_key_step_6)
    AND image_key_step_5 <> image_key_step_6
  ),
  CONSTRAINT perfume_assets_step_keys_format CHECK (((image_key_step_1 ~ (('^a/'::text || asset_random_id) || '/[0-9a-f]{32}\.avif$'::text)) AND (image_key_step_2 ~ (('^a/'::text || asset_random_id) || '/[0-9a-f]{32}\.avif$'::text)) AND (image_key_step_3 ~ (('^a/'::text || asset_random_id) || '/[0-9a-f]{32}\.avif$'::text)) AND (image_key_step_4 ~ (('^a/'::text || asset_random_id) || '/[0-9a-f]{32}\.avif$'::text)) AND (image_key_step_5 ~ (('^a/'::text || asset_random_id) || '/[0-9a-f]{32}\.avif$'::text)) AND (image_key_step_6 ~ (('^a/'::text || asset_random_id) || '/[0-9a-f]{32}\.avif$'::text))))
);

CREATE TABLE public.perfume_asset_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  perfume_id uuid,
  version integer NOT NULL DEFAULT 1,
  source_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'web_catalog'::text,
  license_status text DEFAULT 'unknown'::text,
  takedown_status text DEFAULT 'active'::text,
  original_filename text,
  scraped_at timestamp with time zone DEFAULT now(),
  CONSTRAINT perfume_asset_sources_pkey PRIMARY KEY (id),
  CONSTRAINT perfume_asset_sources_perfume_id_fkey FOREIGN KEY (perfume_id) REFERENCES public.perfumes(id) ON DELETE CASCADE,
  CONSTRAINT perfume_asset_sources_perfume_id_version_key UNIQUE (perfume_id, version),
  CONSTRAINT perfume_asset_sources_source_type_check CHECK ((source_type = ANY (ARRAY['web_catalog'::text, 'brand_press'::text, 'own_photo'::text, 'stock'::text]))),
  CONSTRAINT perfume_asset_sources_takedown_status_check CHECK ((takedown_status = ANY (ARRAY['active'::text, 'takedown_requested'::text, 'removed'::text])))
);

CREATE TABLE public.daily_challenges (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  challenge_number serial NOT NULL,
  challenge_date date NOT NULL,
  perfume_id uuid NOT NULL,
  mode text DEFAULT 'standard'::text,
  seed_hash text NOT NULL,
  snapshot_metadata jsonb NOT NULL,
  snapshot_schema_version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  grace_deadline_at_utc timestamp with time zone NOT NULL,
  CONSTRAINT daily_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT daily_challenges_challenge_date_key UNIQUE (challenge_date),
  CONSTRAINT daily_challenges_mode_check CHECK ((mode = 'standard'::text)),
  CONSTRAINT daily_challenges_perfume_id_fkey FOREIGN KEY (perfume_id) REFERENCES public.perfumes(id)
);

CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.player_auth_links (
  auth_user_id uuid NOT NULL,
  player_id uuid NOT NULL,
  linked_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  CONSTRAINT player_auth_links_pkey PRIMARY KEY (auth_user_id),
  CONSTRAINT player_auth_links_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE
);

CREATE TABLE public.recovery_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  key_id text NOT NULL,
  kdf text NOT NULL DEFAULT 'scrypt'::text,
  salt bytea NOT NULL,
  hash bytea NOT NULL,
  params jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  rotated_from uuid,
  CONSTRAINT recovery_keys_pkey PRIMARY KEY (id),
  CONSTRAINT recovery_keys_key_id_key UNIQUE (key_id),
  CONSTRAINT recovery_keys_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
  CONSTRAINT recovery_keys_rotated_from_fkey FOREIGN KEY (rotated_from) REFERENCES public.recovery_keys(id)
);

-- last_nonce is text with a numeric default in production; kept as is.
CREATE TABLE public.game_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid,
  player_id uuid,
  start_time timestamp with time zone DEFAULT now(),
  last_guess timestamp with time zone DEFAULT now(),
  attempts_count integer DEFAULT 0,
  last_nonce text DEFAULT 0,
  guesses jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT game_sessions_attempts_count_check CHECK (((attempts_count >= 0) AND (attempts_count <= 6))),
  CONSTRAINT game_sessions_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.daily_challenges(id),
  CONSTRAINT game_sessions_player_id_challenge_id_key UNIQUE (player_id, challenge_id),
  CONSTRAINT game_sessions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
  CONSTRAINT game_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'won'::text, 'lost'::text, 'abandoned'::text])))
);

CREATE TABLE public.game_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid,
  player_id uuid,
  session_id uuid,
  status text DEFAULT 'won'::text,
  score integer NOT NULL,
  score_raw integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL,
  time_seconds integer NOT NULL,
  completed_at timestamp with time zone DEFAULT now(),
  scoring_version integer NOT NULL DEFAULT 1,
  is_ranked boolean NOT NULL DEFAULT true,
  ranked_reason text,
  CONSTRAINT game_results_pkey PRIMARY KEY (id),
  CONSTRAINT game_results_attempts_check CHECK (((attempts >= 1) AND (attempts <= 6))),
  CONSTRAINT game_results_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.daily_challenges(id),
  CONSTRAINT game_results_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
  CONSTRAINT game_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT game_results_status_check CHECK ((status = ANY (ARRAY['won'::text, 'lost'::text, 'abandoned'::text])))
);

CREATE TABLE public.streak_freezes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  player_id uuid NOT NULL,
  for_date date NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT streak_freezes_pkey PRIMARY KEY (id),
  CONSTRAINT streak_freezes_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
  CONSTRAINT streak_freezes_player_id_for_date_key UNIQUE (player_id, for_date)
);

CREATE TABLE public.player_streaks (
  player_id uuid NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_played_date date,
  jokers_remaining integer NOT NULL DEFAULT 1,
  joker_used_date date,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_streaks_pkey PRIMARY KEY (player_id),
  CONSTRAINT player_streaks_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE
);

CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_name_key UNIQUE (name),
  CONSTRAINT teams_slug_key UNIQUE (slug)
);

CREATE TABLE public.seasons (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT false,
  CONSTRAINT seasons_pkey PRIMARY KEY (id)
);

CREATE TABLE public.player_profiles (
  user_id uuid NOT NULL,
  username text,
  public_id text DEFAULT "substring"(md5((random())::text), 1, 10),
  team_id uuid,
  stats jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  last_seen_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT player_profiles_public_id_key UNIQUE (public_id),
  CONSTRAINT player_profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT player_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.players(id) ON DELETE CASCADE,
  CONSTRAINT player_profiles_username_key UNIQUE (username)
);

CREATE TABLE public.app_admins (
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_admins_pkey PRIMARY KEY (user_id),
  CONSTRAINT app_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- One row per auth session, kept by the triggers on auth.sessions below.
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token_hash text,
  device_info jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  last_active_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  revoked_at timestamp with time zone,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes -----------------------------------------------------------------------------------------

CREATE INDEX idx_brands_name_trgm ON public.brands USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_brands_name_unaccent_trgm ON public.brands USING gin (public.f_unaccent(name) extensions.gin_trgm_ops);
CREATE INDEX idx_game_results_session_id ON public.game_results USING btree (session_id);
CREATE UNIQUE INDEX idx_unique_game_per_user_day ON public.game_results USING btree (player_id, challenge_id);
CREATE INDEX idx_perfumes_active ON public.perfumes USING btree (is_active);
CREATE INDEX idx_perfumes_brand ON public.perfumes USING btree (brand_id);
CREATE INDEX idx_perfumes_concentration_id ON public.perfumes USING btree (concentration_id);
CREATE INDEX idx_perfumes_eligible ON public.perfumes USING btree (is_uncertain) WHERE (is_uncertain = false);
CREATE INDEX idx_perfumes_name ON public.perfumes USING btree (name);
CREATE INDEX idx_perfumes_name_trgm ON public.perfumes USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_perfumes_name_unaccent_trgm ON public.perfumes USING gin (public.f_unaccent(name) extensions.gin_trgm_ops);
CREATE INDEX idx_perfumes_unique_slug ON public.perfumes USING btree (unique_slug);
CREATE INDEX idx_sessions_challenge_id ON public.game_sessions USING btree (challenge_id);
CREATE INDEX idx_sessions_player ON public.game_sessions USING btree (player_id);
CREATE INDEX idx_user_sessions_last_active ON public.user_sessions USING btree (last_active_at);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);

-- Views -------------------------------------------------------------------------------------------

-- Client-facing views run with the caller's privileges; client roles cannot read the base tables.
CREATE VIEW public.perfumes_public WITH (security_invoker = true) AS
SELECT p.id,
  p.brand_id,
  b.name AS brand_name,
  p.name,
  p.unique_slug,
  p.release_year,
  p.concentration_id,
  c.name AS concentration_name,
  p.gender,
  p.manufacturer_id,
  p.is_uncertain,
  p.is_linear,
  p.games_played,
  p.solve_rate
FROM public.perfumes p
  JOIN public.brands b ON p.brand_id = b.id
  LEFT JOIN public.concentrations c ON p.concentration_id = c.id
WHERE p.is_active = true;

CREATE VIEW public.daily_challenges_public WITH (security_invoker = true) AS
SELECT id,
  challenge_date,
  mode,
  grace_deadline_at_utc,
  snapshot_metadata
FROM public.daily_challenges;

CREATE MATERIALIZED VIEW public.perfume_autocomplete_cache AS
SELECT p.id AS perfume_id,
  p.name,
  b.name AS brand_name,
  p.release_year,
  c.name AS concentration_name,
  lower(public.normalize_search_text(p.name)) AS name_norm,
  lower(public.normalize_search_text(b.name)) AS brand_norm,
  lower(public.normalize_search_text((b.name || ' '::text) || p.name)) AS brand_name_concat,
  lower(public.normalize_search_text((p.name || ' '::text) || b.name)) AS name_brand_concat,
  extensions.dmetaphone(p.name) AS name_phonetic,
  extensions.dmetaphone(b.name) AS brand_phonetic,
  CASE c.name
    WHEN 'Eau de Toilette'::text THEN 1
    WHEN 'Eau de Parfum'::text THEN 2
    WHEN 'Parfum de Toilette'::text THEN 3
    WHEN 'Parfum'::text THEN 4
    WHEN 'Pure Perfume'::text THEN 5
    WHEN 'Extrait de Parfum'::text THEN 6
    WHEN 'Eau de Cologne'::text THEN 7
    WHEN 'Eau Fraîche'::text THEN 8
    WHEN 'Perfume Oil'::text THEN 9
    ELSE 99
  END AS concentration_rank,
  length(p.name) AS name_length
FROM public.perfumes p
  JOIN public.brands b ON b.id = p.brand_id
  LEFT JOIN public.concentrations c ON c.id = p.concentration_id
WHERE p.is_active = true
WITH DATA;

-- The unique index allows REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX idx_ac_cache_perfume_id ON public.perfume_autocomplete_cache USING btree (perfume_id);
CREATE INDEX idx_ac_cache_brand_name_concat ON public.perfume_autocomplete_cache USING btree (brand_name_concat text_pattern_ops);
CREATE INDEX idx_ac_cache_brand_name_trgm ON public.perfume_autocomplete_cache USING gin (brand_name_concat extensions.gin_trgm_ops);
CREATE INDEX idx_ac_cache_brand_norm ON public.perfume_autocomplete_cache USING btree (brand_norm text_pattern_ops);
CREATE INDEX idx_ac_cache_brand_phonetic ON public.perfume_autocomplete_cache USING btree (brand_phonetic);
CREATE INDEX idx_ac_cache_brand_trgm ON public.perfume_autocomplete_cache USING gin (brand_norm extensions.gin_trgm_ops);
CREATE INDEX idx_ac_cache_concentration_rank ON public.perfume_autocomplete_cache USING btree (concentration_rank);
CREATE INDEX idx_ac_cache_name_brand_concat ON public.perfume_autocomplete_cache USING btree (name_brand_concat text_pattern_ops);
CREATE INDEX idx_ac_cache_name_brand_trgm ON public.perfume_autocomplete_cache USING gin (name_brand_concat extensions.gin_trgm_ops);
CREATE INDEX idx_ac_cache_name_length ON public.perfume_autocomplete_cache USING btree (name_length);
CREATE INDEX idx_ac_cache_name_norm ON public.perfume_autocomplete_cache USING btree (name_norm text_pattern_ops);
CREATE INDEX idx_ac_cache_name_phonetic ON public.perfume_autocomplete_cache USING btree (name_phonetic);
CREATE INDEX idx_ac_cache_name_trgm ON public.perfume_autocomplete_cache USING gin (name_norm extensions.gin_trgm_ops);

-- Remaining functions -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_perfumes_unaccent_v2(search_query text, limit_count integer DEFAULT 60)
 RETURNS TABLE(id uuid, name text, year integer, brand_name text, concentration text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  search_norm TEXT;
  is_multiword BOOLEAN;
  tokens TEXT[];
  fuzzy_threshold REAL;
BEGIN
  IF LENGTH(search_query) < 3 THEN
    RETURN;
  END IF;

  search_norm := LOWER(public.f_unaccent(search_query));
  is_multiword := search_query LIKE '% %';
  tokens := string_to_array(search_norm, ' ');

  fuzzy_threshold := CASE
    WHEN LENGTH(search_query) <= 3 THEN 0.7
    WHEN LENGTH(search_query) <= 5 THEN 0.6
    ELSE 0.5
  END;

  RETURN QUERY
  WITH ranked_results AS (
    SELECT
      c.perfume_id,
      c.name,
      c.release_year,
      c.brand_name,
      c.concentration_name,
      c.name_length,
      c.concentration_rank,
      (c.name_norm = search_norm)::INT AS p1,
      (c.brand_norm = search_norm)::INT AS p2,
      (c.brand_name_concat LIKE search_norm || '%')::INT AS p3,
      (c.name_brand_concat LIKE search_norm || '%')::INT AS p4,
      (c.name_norm LIKE search_norm || '%')::INT AS p5,
      (c.brand_norm LIKE search_norm || '%')::INT AS p6,
      (
        (' ' || c.brand_norm || ' ') LIKE '% ' || search_norm || ' %'
        OR (' ' || c.name_norm || ' ') LIKE '% ' || search_norm || ' %'
      )::INT AS p_word,
      (
        NOT is_multiword
        AND LENGTH(search_query) >= 5
        AND (
          c.name_phonetic = extensions.dmetaphone(search_query)
          OR c.brand_phonetic = extensions.dmetaphone(search_query)
        )
      )::INT AS p7,
      CASE
        WHEN c.brand_name_concat LIKE '%' || search_norm || '%'
        THEN 1000 - POSITION(search_norm IN c.brand_name_concat)
        ELSE 0
      END AS p8
    FROM perfume_autocomplete_cache c
    WHERE
      CASE
        WHEN NOT is_multiword THEN (
          c.name_norm ILIKE '%' || search_norm || '%'
          OR c.brand_norm ILIKE '%' || search_norm || '%'
          OR (LENGTH(search_query) >= 5 AND c.name_phonetic = extensions.dmetaphone(search_query))
          OR (LENGTH(search_query) >= 5 AND c.brand_phonetic = extensions.dmetaphone(search_query))
          OR (LENGTH(search_query) >= 4 AND extensions.similarity(c.name_norm, search_norm) > fuzzy_threshold)
          OR (LENGTH(search_query) >= 4 AND extensions.similarity(c.brand_norm, search_norm) > fuzzy_threshold)
        )
        ELSE (
          NOT EXISTS (
            SELECT 1 FROM unnest(tokens) AS token
            WHERE
              c.brand_name_concat NOT ILIKE '%' || token || '%'
              AND NOT (
                LENGTH(token) >= 4
                AND extensions.word_similarity(token, c.brand_name_concat) > 0.35
              )
          )
        )
      END
  )
  SELECT
    r.perfume_id AS id,
    r.name,
    r.release_year AS year,
    r.brand_name,
    r.concentration_name AS concentration
  FROM ranked_results r
  ORDER BY
    r.p1 DESC, r.p2 DESC, r.p3 DESC, r.p4 DESC,
    r.p5 DESC, r.p6 DESC, r.p_word DESC, r.p7 DESC, r.p8 DESC,
    r.name_length ASC,
    LOWER(r.brand_name),
    LOWER(r.name),
    r.concentration_rank,
    r.release_year ASC NULLS LAST
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_autocomplete_cache()
 RETURNS TABLE(rows_refreshed bigint, refresh_duration_ms numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  row_count BIGINT;
BEGIN
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY perfume_autocomplete_cache;
  end_time := clock_timestamp();
  
  SELECT COUNT(*) INTO row_count FROM perfume_autocomplete_cache;
  
  RETURN QUERY SELECT
    row_count,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guest_merge_preview(p_guest_id uuid, p_account_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.transfer_guest_games(p_guest_id uuid, p_account_id uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_auth_session(session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
BEGIN
  DELETE FROM auth.sessions WHERE id = session_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Insert/update player record
  INSERT INTO public.players (id, created_at, last_seen_at)
  VALUES (
    NEW.id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET last_seen_at = NOW();

  -- Create player_auth_link for tracking
  INSERT INTO public.player_auth_links (auth_user_id, player_id, linked_at)
  VALUES (
    NEW.id,
    NEW.id,
    NOW()
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_player()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Insert player record with same ID as auth user
  -- ON CONFLICT prevents errors if player already exists
  INSERT INTO public.players (id, created_at, last_seen_at)
  VALUES (
    NEW.id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET last_seen_at = NOW();

  -- Create player_auth_link entry to track auth → player mapping
  -- This is useful for future features like account linking
  INSERT INTO public.player_auth_links (auth_user_id, player_id, linked_at)
  VALUES (
    NEW.id,
    NEW.id,
    NOW()
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
BEGIN
  -- Insert into public.user_sessions
  -- We use the auth.sessions.id as session_token_hash to link them if needed,
  -- though auth.sessions.id is NOT the raw token, it's a stable ID.
  INSERT INTO public.user_sessions (
    user_id,
    session_token_hash, -- Storing the auth.sessions ID here
    ip_address,
    device_info,
    created_at,
    last_active_at
  )
  VALUES (
    NEW.user_id,
    NEW.id::text,
    NEW.ip,
    jsonb_build_object('user_agent', NEW.user_agent),
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT DO NOTHING; -- Avoid duplicates if triggered multiple times

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_session_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
BEGIN
  -- Update public.user_sessions
  -- We only update if the metadata actually looks like it comes from a real request (not empty)
  -- But auth.sessions doesn't guarantee non-null ip/ua.
  UPDATE public.user_sessions
  SET
    ip_address = NEW.ip,
    device_info = jsonb_build_object('user_agent', NEW.user_agent),
    last_active_at = NEW.updated_at
  WHERE session_token_hash = NEW.id::text
    -- Optional: Only update if the new UA is "better" than "node"?
    -- No, simpler to just sync. If browser refreshes token, it should send browser UA.
    AND revoked_at IS NULL;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_session_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
BEGIN
  -- Mark as revoked in public.user_sessions
  UPDATE public.user_sessions
  SET revoked_at = NOW()
  WHERE session_token_hash = OLD.id::text
    AND revoked_at IS NULL;

  RETURN OLD;
END;
$function$;


-- Triggers ----------------------------------------------------------------------------------------

CREATE TRIGGER set_unique_slug
  BEFORE INSERT OR UPDATE ON public.perfumes
  FOR EACH ROW EXECUTE FUNCTION public.generate_unique_slug();

-- Every sign-up creates the player row, and every auth session is mirrored in user_sessions.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_player();
CREATE TRIGGER on_auth_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_session();
CREATE TRIGGER on_auth_session_updated
  AFTER UPDATE ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_session_update();
CREATE TRIGGER on_auth_session_deleted
  AFTER DELETE ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_session_delete();

-- Row level security ------------------------------------------------------------------------------

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_aliases_etl ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concentrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_asset_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_perfumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_source_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_auth_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only app_admins" ON public.app_admins
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read brand_aliases" ON public.brand_aliases
  FOR SELECT USING (true);
CREATE POLICY "Enable service_role access" ON public.brand_aliases_etl
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read brands" ON public.brands
  FOR SELECT USING (true);
CREATE POLICY "Public read concentrations" ON public.concentrations
  FOR SELECT USING (true);
CREATE POLICY "Owner read results" ON public.game_results
  FOR SELECT USING ((SELECT auth.uid()) = player_id);
CREATE POLICY "Owner read sessions" ON public.game_sessions
  FOR SELECT USING ((SELECT auth.uid()) = player_id);
CREATE POLICY "Enable service_role access" ON public.import_conflicts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable service_role access" ON public.import_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read manufacturers" ON public.manufacturers
  FOR SELECT USING (true);
CREATE POLICY "Public read notes" ON public.notes
  FOR SELECT USING (true);
CREATE POLICY "Enable service_role access" ON public.perfume_asset_sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read perfume_notes" ON public.perfume_notes
  FOR SELECT USING (true);
CREATE POLICY "Public read perfume_perfumers" ON public.perfume_perfumers
  FOR SELECT USING (true);
CREATE POLICY "Enable service_role access" ON public.perfume_revisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Enable service_role access" ON public.perfume_source_urls
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read perfumers" ON public.perfumers
  FOR SELECT USING (true);
CREATE POLICY "Owner delete auth links" ON public.player_auth_links
  FOR DELETE USING (player_id = (SELECT auth.uid()));
CREATE POLICY "Owner read auth links" ON public.player_auth_links
  FOR SELECT USING (player_id = (SELECT auth.uid()));
CREATE POLICY "Service role all auth links" ON public.player_auth_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Owner insert player_profiles" ON public.player_profiles
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner read player_profiles" ON public.player_profiles
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner update player_profiles" ON public.player_profiles
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner read streaks" ON public.player_streaks
  FOR SELECT USING ((SELECT auth.uid()) = player_id);
CREATE POLICY "Enable service_role access" ON public.raw_import_rows
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Owner read recovery keys" ON public.recovery_keys
  FOR SELECT USING (player_id = (SELECT auth.uid()));
CREATE POLICY "Service role all recovery keys" ON public.recovery_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read seasons" ON public.seasons
  FOR SELECT USING (true);
CREATE POLICY "Owner insert streak_freezes" ON public.streak_freezes
  FOR INSERT WITH CHECK (player_id = (SELECT auth.uid()));
CREATE POLICY "Owner read streak_freezes" ON public.streak_freezes
  FOR SELECT USING (player_id = (SELECT auth.uid()));
CREATE POLICY "Public read teams" ON public.teams
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Privileges --------------------------------------------------------------------------------------

-- Start from nothing so the result does not depend on the platform's default privileges, then grant
-- exactly what production has. Client roles never get TRUNCATE, TRIGGER, REFERENCES or MAINTAIN.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.app_admins, public.brand_aliases, public.brands, public.concentrations, public.manufacturers,
  public.notes, public.perfume_asset_sources, public.perfume_notes, public.perfume_perfumers,
  public.perfumers, public.seasons, public.streak_freezes, public.teams,
  public.perfumes_public, public.daily_challenges_public, public.perfume_autocomplete_cache
  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON
  public.daily_challenges, public.perfumes, public.player_profiles, public.user_sessions
  TO anon, authenticated;
-- Players read their own rows under RLS; game state is written only by the server (service_role).
GRANT SELECT ON
  public.player_profiles, public.user_sessions, public.game_sessions, public.game_results, public.player_streaks
  TO authenticated;

-- search_perfumes_unaccent_v2 is the client's search RPC; the rest run inside queries and triggers.
GRANT EXECUTE ON FUNCTION
  public.search_perfumes_unaccent_v2(text, integer),
  public.f_unaccent(text),
  public.normalize_search_text(text),
  public.slugify(text),
  public.generate_unique_slug(),
  public.extensions_dmetaphone(text),
  public.extensions_f_unaccent(text)
  TO PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES FROM anon, authenticated;

-- Comments ----------------------------------------------------------------------------------------

COMMENT ON VIEW public.perfumes_public IS 'Public view of perfumes without sensitive data. Security invoker enabled (2026-02-14).';
COMMENT ON VIEW public.daily_challenges_public IS 'Public view of daily challenges metadata. Security invoker enabled (2026-02-14).';
COMMENT ON COLUMN public.perfumes.top_notes IS 'Cleaned list of top notes';
COMMENT ON COLUMN public.perfumes.middle_notes IS 'Cleaned list of middle/heart notes';
COMMENT ON COLUMN public.perfumes.base_notes IS 'Cleaned list of base notes';
COMMENT ON COLUMN public.perfumes.perfumers IS 'List of perumers (creators)';
COMMENT ON FUNCTION public.f_unaccent(text) IS 'Remove diacritics from text. Search path locked for security.';
COMMENT ON FUNCTION public.normalize_search_text(text) IS 'Removes accents, special chars, and normalizes "No5" → "N5" pattern';
COMMENT ON FUNCTION public.refresh_autocomplete_cache() IS 'Refreshes autocomplete cache. Call after perfume imports.';
