-- ============================================
-- Supabase Schema: Fragrance Game (v5 Enterprise)
-- PostgreSQL 17 (Supabase)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable Trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- CONCENTRATIONS (Lookup table)
-- ============================================
CREATE TABLE IF NOT EXISTS concentrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
);

-- ============================================
-- MANUFACTURERS (Production companies)
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
    source_record_slug TEXT NOT NULL UNIQUE, -- Slug from import (unstable)
    unique_slug TEXT UNIQUE,  -- App routing slug (stable): brand_name_concentration_year[_N]
    
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
    is_active BOOLEAN DEFAULT TRUE, -- Soft delete / filter
    main_accords TEXT[] DEFAULT '{}',
    
    -- Game Metrics (Updated via Triggers/Jobs)
    games_played INT NOT NULL DEFAULT 0,
    solve_rate FLOAT,  -- Empirical difficulty (Trigger updated)
    
    -- xSolve (Static Difficulty - Python ETL Source of Truth)
    xsolve_score FLOAT DEFAULT 0,      -- Calculated in Python
    xsolve_model_version INT DEFAULT 1, -- To track algorithm updates
    
    -- ETL Metadata
    fingerprint_strict TEXT, 
    fingerprint_loose TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_gender CHECK (gender IN ('Male', 'Female', 'Unisex') OR gender IS NULL),
    CONSTRAINT unique_perfume UNIQUE NULLS NOT DISTINCT (brand_id, name, concentration_id, release_year)
);

-- Performance indexes
CREATE INDEX idx_perfumes_brand ON perfumes(brand_id);
CREATE INDEX idx_perfumes_name ON perfumes(name);
CREATE INDEX idx_perfumes_rating ON perfumes(rating_count DESC NULLS LAST);
CREATE INDEX idx_perfumes_accords ON perfumes USING GIN (main_accords);
CREATE INDEX idx_perfumes_unique_slug ON perfumes(unique_slug);
CREATE INDEX idx_perfumes_eligible ON perfumes(is_uncertain) WHERE is_uncertain = FALSE;
CREATE INDEX idx_perfumes_active ON perfumes(is_active);

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
CREATE INDEX idx_notes_display_name ON notes(display_name);

CREATE TABLE IF NOT EXISTS perfume_notes (
    perfume_id UUID NOT NULL REFERENCES perfumes(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('top', 'middle', 'base')),
    qualifiers TEXT[] DEFAULT '{}', -- e.g. ['Absolute', 'Orpur']
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfume_id uuid NOT NULL REFERENCES perfumes(id) ON DELETE CASCADE,
  import_run_id uuid REFERENCES import_runs(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  diff_jsonb jsonb NOT NULL
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
-- ASSET GOVERNANCE & PROVENANCE
-- ============================================
CREATE TABLE IF NOT EXISTS perfume_assets (
    perfume_id UUID PRIMARY KEY REFERENCES perfumes(id) ON DELETE CASCADE,
    asset_version INT NOT NULL DEFAULT 1,
    image_key_base TEXT NOT NULL,       -- e.g. 'p/{id}/v1/base.avif'
    -- Varianty baked (a1=blur, a6=sharp)
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
    source_type TEXT NOT NULL CHECK (source_type IN ('web_catalog', 'brand_press', 'own_photo', 'stock', 'unknown')),
    source_url TEXT,
    source_retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Legal / Takedown Status
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
    mode TEXT DEFAULT 'standard' CHECK (mode IN ('standard')), -- MVP: Only 'standard' mode
    seed_hash TEXT NOT NULL,
    
    -- Time Source of Truth
    grace_deadline_at_utc TIMESTAMPTZ NOT NULL, -- challenge_date + 30 min (Session Kill Time)
    
    -- Snapshot (Immutable History)
    snapshot_metadata jsonb NOT NULL, 
    snapshot_schema_version int NOT NULL DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Server Actions read only. denied for public/anon.

-- ============================================
-- IDENTITY & AUTH (Zero-Friction Architecture)
-- ============================================
CREATE TABLE public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

CREATE TABLE public.player_auth_links (
    auth_user_id UUID PRIMARY KEY, -- FK to auth.users.id
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_player_auth_links_player ON public.player_auth_links(player_id);

CREATE TABLE public.recovery_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    key_id TEXT NOT NULL UNIQUE, -- Public ID (e.g. RK-1234)
    
    -- Crypto parameters (Scrypt)
    kdf TEXT NOT NULL DEFAULT 'scrypt',
    salt BYTEA NOT NULL,
    hash BYTEA NOT NULL,      -- The actual hash
    params JSONB NOT NULL,    -- {n, r, p} params for scrypt
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    rotated_from UUID REFERENCES public.recovery_keys(id)
);
CREATE INDEX idx_recovery_keys_player ON public.recovery_keys(player_id);

-- ============================================
-- GAME SESSIONS (Auth: Managed via players table)
-- ============================================
CREATE TABLE public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.daily_challenges(id),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE, -- Game Identity
  
  start_time TIMESTAMPTZ DEFAULT NOW(),
  last_guess TIMESTAMPTZ DEFAULT NOW(),
  attempts_count INT DEFAULT 0 CHECK (attempts_count BETWEEN 0 AND 6),
  
  -- Atomic State & Locking
  last_nonce INT DEFAULT 0,
  guesses JSONB DEFAULT '[]'::jsonb, -- Array of {id, at, result}
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'abandoned')),
  metadata JSONB DEFAULT '{}'::jsonb -- Additional runtime state
);
CREATE INDEX idx_sessions_player ON game_sessions(player_id);
-- RLS: Only Owner can SELECT. No public INSERT/UPDATE (Server Action only).

-- ============================================
-- GAME RESULTS
-- ============================================
CREATE TABLE public.game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.daily_challenges(id),
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL, -- GDPR: Keep result, forget player
  session_id UUID REFERENCES public.game_sessions(id),
  
  status TEXT DEFAULT 'won' CHECK (status IN ('won', 'lost', 'abandoned')),
  score INT NOT NULL,
  score_raw INT NOT NULL DEFAULT 0, -- Base Score (No Streak)
  attempts INT NOT NULL CHECK (attempts BETWEEN 1 AND 6),
  time_seconds INT NOT NULL, -- Duration of the game
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Scoring Metadata (Audit)
  scoring_version INT NOT NULL DEFAULT 1,
  
  is_ranked BOOLEAN NOT NULL DEFAULT true,
  ranked_reason TEXT
);
CREATE INDEX idx_results_player ON game_results(player_id);
CREATE INDEX idx_results_challenge ON game_results(challenge_id);
-- Hard constraint: One Ranked Game Result per Player per Challenge
CREATE UNIQUE INDEX idx_unique_game_per_user_day ON game_results(player_id, challenge_id);
-- Performance indexes for analytics/scheduling
CREATE INDEX idx_daily_challenges_mode_date ON daily_challenges(mode, challenge_date);
CREATE INDEX idx_game_results_challenge_completed ON game_results(challenge_id, completed_at);
CREATE INDEX idx_game_results_challenge_status ON game_results(challenge_id, status);

-- ============================================
-- STREAK FREEZES (Joker Shield)
-- ============================================
CREATE TABLE IF NOT EXISTS streak_freezes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    for_date DATE NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, for_date)
);
CREATE INDEX idx_streak_freezes_player ON streak_freezes(player_id);

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
-- RETENTION & SEASONS (Mechanics V2)
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
    user_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE, -- Keyed by Player ID
    username TEXT UNIQUE,
    public_id TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 10),
    team_id UUID REFERENCES teams(id),
    stats JSONB DEFAULT '{}'::jsonb, -- Hall of Fame / Medals
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ETL / ADMIN TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS brand_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias_name TEXT NOT NULL, 
  normalized_name TEXT NOT NULL,
  brand_id UUID REFERENCES brands(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_run_id UUID,
  fingerprint_loose TEXT NOT NULL,
  conflict_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APP ADMINS (RBAC)
-- ============================================
CREATE TABLE IF NOT EXISTS app_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: Only Service Role can manage admins.
ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- Note: update_perfume_solve_rate trigger REMOVED to avoid write contention.
-- Stat calculation should be done via lazy aggregation or background jobs.

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
CREATE MATERIALIZED VIEW public.perfume_autocomplete_cache AS
SELECT
    p.id AS perfume_id,
    p.name,
    b.name AS brand_name,
    p.release_year,
    -- Simple UI Key
    LOWER(TRIM(p.name)) || '|' || LOWER(TRIM(b.name)) AS ui_key
FROM perfumes p
JOIN brands b ON b.id = p.brand_id
WHERE p.rating_count >= 1;

CREATE UNIQUE INDEX idx_ac_id ON public.perfume_autocomplete_cache(perfume_id);
CREATE INDEX IF NOT EXISTS idx_ac_trigram ON public.perfume_autocomplete_cache USING GIN (name gin_trgm_ops);

-- ============================================
-- RLS POLICIES (Server Authority)
-- ============================================
ALTER TABLE perfumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read perfumes" ON perfumes FOR SELECT USING (true);
-- Write: Service Role only.

ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
-- No public policies = DENY ALL. (Service Role only).

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
-- Owner read only (for debug/recovery state)
CREATE POLICY "Owner read sessions" ON game_sessions FOR SELECT USING (auth.uid() = player_id);
-- INSERT/UPDATE: DENIED (Service Role Only).

ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read results" ON game_results FOR SELECT USING (auth.uid() = player_id);
-- INSERT/UPDATE: DENIED (Service Role Only).

ALTER TABLE player_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read streaks" ON player_streaks FOR SELECT USING (auth.uid() = player_id);
