-- Phase JL1a: Job Leads Pipeline foundation

-- 1. Add body_text to emails (full plain text, not truncated)
ALTER TABLE emails ADD COLUMN IF NOT EXISTS body_text text DEFAULT NULL;

-- 2. Add lead tracking columns to job_listings
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS lead_status text DEFAULT NULL
  CHECK (lead_status IS NULL OR lead_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS source_email_id uuid
  REFERENCES emails(id) DEFAULT NULL;

ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS auto_approved boolean DEFAULT false;

-- Index for the Job Leads page queries
CREATE INDEX IF NOT EXISTS idx_job_listings_lead_status
  ON job_listings(user_id, lead_status) WHERE lead_status IS NOT NULL;

-- 3. Create job_email_sources table (learned sender patterns)
CREATE TABLE IF NOT EXISTS job_email_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_email text NOT NULL,
  sender_domain text NOT NULL,
  display_name text,
  subject_pattern text,
  is_auto_extract boolean DEFAULT false,
  is_trusted boolean DEFAULT false,
  total_extracted integer DEFAULT 0,
  total_approved integer DEFAULT 0,
  total_rejected integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, sender_email)
);

ALTER TABLE job_email_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email sources" ON job_email_sources
  FOR ALL USING (auth.uid() = user_id);

-- 4. Add job_alert to email classification check constraint
-- The emails.classification column is plain text with no existing named CHECK constraint.
-- Add one now so job_alert is a valid value.
ALTER TABLE emails ADD CONSTRAINT emails_classification_check
  CHECK (classification IN ('rejection', 'interview_invite', 'followup', 'offer', 'general', 'unclassified', 'job_alert'));
