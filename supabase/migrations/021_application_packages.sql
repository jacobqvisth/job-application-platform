-- Phase AS1: Application Studio — application_packages table

CREATE TABLE IF NOT EXISTS application_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE SET NULL,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,

  -- Pipeline state
  status text NOT NULL DEFAULT 'analyzing'
    CHECK (status IN (
      'analyzing',
      'checkpoint_1',
      'matching',
      'checkpoint_2',
      'generating',
      'checkpoint_3',
      'completed',
      'abandoned'
    )),

  -- Step 1: Job Analysis (Haiku)
  job_analysis jsonb,

  -- Step 2: Company Research (Haiku)
  company_research jsonb,

  -- Checkpoint 1 edits
  checkpoint_1_edits jsonb,

  -- Step 3: Evidence Matching (Sonnet) — AS2
  evidence_mapping jsonb,

  -- Step 4: Application Strategy (Sonnet) — AS2
  strategy jsonb,

  -- Checkpoint 2 edits — AS2
  checkpoint_2_edits jsonb,

  -- Step 5: Generated Resume (Opus) — AS3
  generated_resume jsonb,
  resume_id uuid REFERENCES resumes(id) ON DELETE SET NULL,

  -- Step 6: Generated Cover Letter (Opus) — AS3
  generated_cover_letter jsonb,

  -- Step 7a: Screening Questions (Sonnet) — AS3
  screening_questions jsonb,

  -- Step 7b: Quality Review (Sonnet) — AS3
  quality_review jsonb,

  -- Checkpoint 3 edits — AS4
  checkpoint_3_edits jsonb,

  -- AI usage tracking
  ai_usage jsonb DEFAULT '{}',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE application_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own packages"
  ON application_packages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_application_packages_user_status ON application_packages(user_id, status);
CREATE INDEX idx_application_packages_job ON application_packages(job_listing_id);
