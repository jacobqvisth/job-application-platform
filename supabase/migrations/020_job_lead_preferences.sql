-- Phase JL3: Approval learning + auto-approve

-- 1. Store learned preferences per user
CREATE TABLE IF NOT EXISTS job_lead_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(user_id),
  positive_signals text[] DEFAULT '{}',      -- e.g. ["senior", "frontend", "Stockholm"]
  negative_signals text[] DEFAULT '{}',      -- e.g. ["junior", "QA"]
  preferred_companies text[] DEFAULT '{}',
  preferred_locations text[] DEFAULT '{}',
  min_score_threshold integer DEFAULT 70,
  decision_count integer DEFAULT 0,          -- how many decisions were used for this analysis
  last_analyzed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE job_lead_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lead preferences" ON job_lead_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 2. Store the auto-approve reason on job listings
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS auto_approve_reason text DEFAULT NULL;
