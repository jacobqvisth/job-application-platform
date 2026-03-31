-- Apply via Supabase MCP: mcp__b7164669...apply_migration
-- Phase E2: AI Job Scoring — adds AI-scored match fields to job_listings

-- Add AI scoring fields to job_listings
ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS match_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ;

-- Index for finding unscored jobs efficiently
CREATE INDEX IF NOT EXISTS job_listings_unscored_idx
  ON job_listings (user_id, ai_scored_at)
  WHERE ai_scored_at IS NULL;
