-- ============================================
-- Supabase Schema: Fragrance Game (v5 Enterprise)
-- Migration: M1 Foundation (Idempotent)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable Trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- CONCENTRATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS concentrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
);

-- ============================================
-- MANUFACTURERS
-- ============================================
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE
);

-- ============================================
-- BRANDS
-- ============================================
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PERFUMES
-- ============================================
CREATE TABLE IF NOT EXISTS perfumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    
    -- Slugs
    source_record_slug TEXT NOT NULL UNIQUE, 
    unique_slug TEXT UNIQUE,  
    
    release_year INT CHECK (release_year >= 1668 AND release_year <= EXTRACT(YEAR FROM NOW()) + 2),
    concentration_id UUID REFERENCES concentrations(id),
    gender TEXT,
    image_url TEXT CHECK (image_url IS NULL OR image_url ~ '^https?://'),
    rating_value FLOAT CHECK (rating_value >= 0 AND rating_value <= 10),
    rating_count INT CHECK (rating_count >= 0),
    manufacturer_id UUID REFERENCES manufacturers(id),
    origin_url TEXT,
    is_uncertain BOOLEAN DEFAULT FALSE,
    is_linear BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE, 
    main_accords TEXT[] DEFAULT '{}',
    
    -- Game Metrics
    games_played INT NOT NULL DEFAULT 0,
    solve_rate FLOAT,
    
    -- xSolve
    xsolve_score FLOAT DEFAULT 0,      
    xsolve_model_version INT DEFAULT 1, 
    
    -- ETL Metadata
    fingerprint_strict TEXT, 
    fingerprint_loose TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_gender CHECK (gender IN ('Male', 'Female', 'Unisex') OR gender IS NULL),
    CONSTRAINT unique_perfume UNIQUE NULLS NOT DISTINCT (brand_id, name, concentration_id, release_year)
);

-- Performance indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_perfumes_brand ON perfumes(brand_id);
CREATE INDEX IF NOT EXISTS idx_perfumes_name ON perfumes(name);
CREATE INDEX IF NOT EXISTS idx_perfumes_rating ON perfumes(rating_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_perfumes_accords ON perfumes USING GIN (main_accords);
CREATE INDEX IF NOT EXISTS idx_perfumes_unique_slug ON perfumes(unique_slug);
CREATE INDEX IF NOT EXISTS idx_perfumes_eligible ON perfumes(is_uncertain) WHERE is_uncertain = FALSE;
CREATE INDEX IF NOT EXISTS idx_perfumes_active ON perfumes(is_active);

-- ============================================
-- UNIQUE_SLUG TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION slugify(text_input TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(text_input, '[^a-zA-Z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION generate_unique_slug() RETURNS TRIGGER AS $$
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
    WHILE EXISTS(SELECT 1 FROM perfumes WHERE unique_slug = final_slug AND id != COALESCE(NEW.id, uuid_generate_v4())) LOOP
        counter := counter + 1;
        final_slug := base_slug || '_' || counter;
    END LOOP;
    
    NEW.unique_slug := final_slug;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger safely
DROP TRIGGER IF EXISTS set_unique_slug ON perfumes;
CREATE TRIGGER set_unique_slug
BEFORE INSERT OR UPDATE ON perfumes
FOR EACH ROW EXECUTE FUNCTION generate_unique_slug();

-- ============================================
-- NOTES & RELATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    hints TEXT[] DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_notes_display_name ON notes(display_name);

CREATE TABLE IF NOT EXISTS perfume_notes (
    perfume_id UUID NOT NULL REFERENCES perfumes(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('top', 'middle', 'base')),
    qualifiers TEXT[] DEFAULT '{}',
    PRIMARY KEY (perfume_id, note_id, type)
);

CREATE TABLE IF NOT EXISTS perfumers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS perfume_perfumers (
    perfume_id UUID NOT NULL REFERENCES perfumes(id) ON DELETE CASCADE,
    perfumer_id UUID NOT NULL REFERENCES perfumers(id) ON DELETE CASCADE,
    PRIMARY KEY (perfume_id, perfumer_id)
);

-- ============================================
-- ETL WAREHOUSE
-- ============================================
CREATE TABLE IF NOT EXISTS import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  brand_raw text, name_raw text, concentration_raw text, release_year int,
  fp_strict text NOT NULL, fp_loose text NOT NULL,
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perfume_source_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfume_id uuid NOT NULL REFERENCES perfumes(id) ON DELETE CASCADE,
  url text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(perfume_id, url)
);

CREATE TABLE IF NOT EXISTS brand_aliases (
  alias_norm text PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS perfume_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perfume_id UUID REFERENCES perfumes(id) ON DELETE CASCADE,
    fingerprint_strict TEXT NOT NULL,
    diff_json JSONB NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  raw_row_id uuid NOT NULL REFERENCES raw_import_rows(id) ON DELETE CASCADE,
  conflict_type text NOT NULL,
  details jsonb,
  resolved boolean DEFAULT false
);

-- ============================================
-- ASSET GOVERNANCE
-- ============================================
CREATE TABLE IF NOT EXISTS perfume_assets (
    perfume_id UUID PRIMARY KEY REFERENCES perfumes(id) ON DELETE CASCADE,
    asset_version INT NOT NULL DEFAULT 1,
    image_key_base TEXT NOT NULL,       
    image_key_a1 TEXT NOT NULL,
    image_key_a2 TEXT NOT NULL,
    image_key_a3 TEXT NOT NULL,
    image_key_a4 TEXT NOT NULL,
    image_key_a5 TEXT NOT NULL,
    image_key_a6 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS perfume_asset_sources (
    perfume_id UUID PRIMARY KEY REFERENCES perfumes(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('parfumo', 'brand_press', 'own_photo', 'stock', 'unknown')),
    source_url TEXT,
    source_retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    license_status TEXT NOT NULL DEFAULT 'unknown' CHECK (license_status IN ('unknown', 'allowed', 'disallowed')),
    takedown_status TEXT NOT NULL DEFAULT 'none' CHECK (takedown_status IN ('none', 'requested', 'removed')),
    notes TEXT
);

-- ============================================
-- DAILY CHALLENGES
-- ============================================
CREATE TABLE IF NOT EXISTS daily_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_number SERIAL,
    challenge_date DATE NOT NULL UNIQUE,
    perfume_id UUID NOT NULL REFERENCES perfumes(id),
    mode TEXT DEFAULT 'standard' CHECK (mode IN ('standard')), 
    seed_hash TEXT NOT NULL,
    grace_deadline_at_utc TIMESTAMPTZ NOT NULL, 
    snapshot_metadata jsonb NOT NULL, 
    snapshot_schema_version int NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- IDENTITY & AUTH
-- ============================================
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.player_auth_links (
    auth_user_id UUID PRIMARY KEY, 
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_player_auth_links_player ON public.player_auth_links(player_id);

CREATE TABLE IF NOT EXISTS public.recovery_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    key_id TEXT NOT NULL UNIQUE, 
    kdf TEXT NOT NULL DEFAULT 'scrypt',
    salt BYTEA NOT NULL,
    hash BYTEA NOT NULL,      
    params JSONB NOT NULL,    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    rotated_from UUID REFERENCES public.recovery_keys(id)
);
CREATE INDEX IF NOT EXISTS idx_recovery_keys_player ON public.recovery_keys(player_id);

-- ============================================
-- GAME SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.daily_challenges(id),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  last_guess TIMESTAMPTZ DEFAULT NOW(),
  attempts_count INT DEFAULT 0 CHECK (attempts_count BETWEEN 0 AND 6),
  last_nonce INT DEFAULT 0,
  guesses JSONB DEFAULT '[]'::jsonb, 
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'abandoned')),
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_id);

-- ============================================
-- GAME RESULTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.daily_challenges(id),
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL, 
  session_id UUID REFERENCES public.game_sessions(id),
  status TEXT DEFAULT 'won' CHECK (status IN ('won', 'lost', 'abandoned')),
  score INT NOT NULL,
  score_raw INT NOT NULL DEFAULT 0, 
  attempts INT NOT NULL CHECK (attempts BETWEEN 1 AND 6),
  time_seconds INT NOT NULL, 
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  scoring_version INT NOT NULL DEFAULT 1,
  is_ranked BOOLEAN NOT NULL DEFAULT true,
  ranked_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_results_player ON game_results(player_id);
CREATE INDEX IF NOT EXISTS idx_results_challenge ON game_results(challenge_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_game_per_user_day ON game_results(player_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_mode_date ON daily_challenges(mode, challenge_date);
CREATE INDEX IF NOT EXISTS idx_game_results_challenge_completed ON game_results(challenge_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_game_results_challenge_status ON game_results(challenge_id, status);

-- ============================================
-- STREAK FREEZES
-- ============================================
CREATE TABLE IF NOT EXISTS streak_freezes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    for_date DATE NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, for_date)
);
CREATE INDEX IF NOT EXISTS idx_streak_freezes_player ON streak_freezes(player_id);

CREATE TABLE IF NOT EXISTS player_streaks (
    player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    best_streak INT NOT NULL DEFAULT 0,
    last_played_date DATE,
    jokers_remaining INT NOT NULL DEFAULT 1,
    joker_used_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RETENTION & SEASONS
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS player_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    public_id TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 10),
    team_id UUID REFERENCES teams(id),
    stats JSONB DEFAULT '{}'::jsonb, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APP ADMINS
-- ============================================
CREATE TABLE IF NOT EXISTS app_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VIEW: Eligible perfumes
-- ============================================
CREATE OR REPLACE VIEW eligible_perfumes AS
SELECT p.*
FROM perfumes p
WHERE p.is_uncertain = FALSE
  AND p.is_active = TRUE
  AND p.rating_count >= 400
  AND p.image_url IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM daily_challenges dc
      WHERE dc.perfume_id = p.id
      AND dc.challenge_date > CURRENT_DATE - INTERVAL '365 days'
  );

-- ============================================
-- MATERIALIZED VIEW: Autocomplete
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.perfume_autocomplete_cache AS
SELECT
    p.id AS perfume_id,
    p.name,
    b.name AS brand_name,
    p.release_year,
    LOWER(TRIM(p.name)) || '|' || LOWER(TRIM(b.name)) AS ui_key
FROM perfumes p
JOIN brands b ON b.id = p.brand_id
WHERE p.rating_count >= 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ac_id ON public.perfume_autocomplete_cache(perfume_id);
CREATE INDEX IF NOT EXISTS idx_ac_trigram ON public.perfume_autocomplete_cache USING GIN (name gin_trgm_ops);

-- ============================================
-- RLS POLICIES (Idempotent)
-- ============================================
-- Perfumes
ALTER TABLE perfumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read perfumes" ON perfumes;
CREATE POLICY "Public read perfumes" ON perfumes FOR SELECT USING (true);

-- Daily Challenges
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

-- Game Sessions
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner read sessions" ON game_sessions;
CREATE POLICY "Owner read sessions" ON game_sessions FOR SELECT USING (auth.uid() = player_id);

-- Game Results
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner read results" ON game_results;
CREATE POLICY "Owner read results" ON game_results FOR SELECT USING (auth.uid() = player_id);

-- Player Streaks
ALTER TABLE player_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner read streaks" ON player_streaks;
CREATE POLICY "Owner read streaks" ON player_streaks FOR SELECT USING (auth.uid() = player_id);
