-- Create perfume_assets table
CREATE TABLE IF NOT EXISTS public.perfume_assets (
    perfume_id UUID PRIMARY KEY REFERENCES public.perfumes(id) ON DELETE CASCADE,
    asset_random_id TEXT NOT NULL, -- Opaque ID for the URL (e.g., 'a1b2c3d4')
    image_key_step_1 TEXT NOT NULL,
    image_key_step_2 TEXT NOT NULL,
    image_key_step_3 TEXT NOT NULL,
    image_key_step_4 TEXT NOT NULL,
    image_key_step_5 TEXT NOT NULL,
    image_key_step_6 TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up by random ID isn't strictly necessary if we only lookup by perfume_id, 
-- but might be useful if we ever need reverse lookup.
CREATE INDEX IF NOT EXISTS idx_perfume_assets_random_id ON public.perfume_assets(asset_random_id);

-- Create perfume_asset_sources table (Audit Trail)
CREATE TABLE IF NOT EXISTS public.perfume_asset_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfume_id UUID REFERENCES public.perfumes(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'web_catalog' CHECK (source_type IN ('web_catalog', 'brand_press', 'own_photo', 'stock')),
    license_status TEXT DEFAULT 'unknown', -- 'unknown', 'copyrighted', 'public_domain', 'licensed'
    takedown_status TEXT DEFAULT 'active', -- 'active', 'takedown_requested', 'removed'
    original_filename TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (takedown_status IN ('active', 'takedown_requested', 'removed')),
    UNIQUE (perfume_id, version)
);

-- Enable RLS
ALTER TABLE public.perfume_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_asset_sources ENABLE ROW LEVEL SECURITY;

-- Policies
-- Assets are public read (needed for game) - actually the keys are public, the table mapping 
-- might need to be protected to avoid scraping all IDs?
-- For now, allow public read of assets mapping is fine, or restrict to authenticated if we use the server action.
-- The plan says "Server Action getImageUrlForStep", so the client DOES NOT query this table directly.
-- So we can keep it private or restricted to service_role.
-- User: "Server Action getImageUrlForStep" -> This runs on server, uses service_role or authenticated user.
-- Let's allow read for specific challenges? 
-- Simplest: Allow read for authenticated users (authenticated users play the game).
CREATE POLICY "Allow read access for authenticated users" ON public.perfume_assets
    FOR SELECT TO authenticated USING (true);

-- Sources: Only admins/service role should see sources?
-- Let's keep sources private for now, only service role.
