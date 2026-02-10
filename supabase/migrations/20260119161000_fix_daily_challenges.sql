-- Fix missing column in daily_challenges
ALTER TABLE daily_challenges 
ADD COLUMN IF NOT EXISTS grace_deadline_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Remove default if schema.sql didn't have it (optional, but cleaner)
ALTER TABLE daily_challenges 
ALTER COLUMN grace_deadline_at_utc DROP DEFAULT;
