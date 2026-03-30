-- Phase D1a: Universal Job Index — dedup layer for cross-platform job tracking

-- 1. Extend job_listings with normalization + application tracking fields
ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS company_normalized text,
  ADD COLUMN IF NOT EXISTS title_normalized text,
  ADD COLUMN IF NOT EXISTS dedup_fingerprint text,
  ADD COLUMN IF NOT EXISTS all_sources text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS all_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL;

-- Index for fast fingerprint lookups (the core of dedup)
CREATE INDEX IF NOT EXISTS idx_job_listings_dedup_fingerprint
  ON public.job_listings(user_id, dedup_fingerprint)
  WHERE dedup_fingerprint IS NOT NULL;

-- 2. job_listing_sources: tracks every platform where a canonical job was seen
CREATE TABLE IF NOT EXISTS public.job_listing_sources (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_listing_id   uuid        REFERENCES public.job_listings(id) ON DELETE CASCADE NOT NULL,
  user_id          uuid        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  source           text        NOT NULL,   -- 'platsbanken', 'linkedin', 'teamtailor', 'varbi', 'jobylon', 'reachmee', 'adzuna', 'email', 'screenshot', 'manual'
  external_id      text,                   -- job ID in source system (if known)
  source_url       text,
  raw_data         jsonb       DEFAULT '{}',
  seen_at          timestamptz DEFAULT now(),
  UNIQUE(job_listing_id, source)
);

ALTER TABLE public.job_listing_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own job listing sources" ON public.job_listing_sources
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_job_listing_sources_listing
  ON public.job_listing_sources(job_listing_id);
CREATE INDEX IF NOT EXISTS idx_job_listing_sources_user
  ON public.job_listing_sources(user_id);

-- 3. Link applications back to their canonical job listing
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS job_listing_id uuid REFERENCES public.job_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_job_listing
  ON public.applications(job_listing_id)
  WHERE job_listing_id IS NOT NULL;

-- 4. Link emails to their canonical job listing
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS job_listing_id uuid REFERENCES public.job_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_emails_job_listing
  ON public.emails(job_listing_id)
  WHERE job_listing_id IS NOT NULL;

-- 5. Backfill normalization for existing job_listings rows
UPDATE public.job_listings
SET
  company_normalized = lower(trim(
    regexp_replace(
      regexp_replace(company, '\s+(AB|Ltd|Limited|Inc|Corp|LLC|GmbH|AS|ApS|SAS|BV|NV|SA|Plc|Group)\s*$', '', 'gi'),
      '[&,\.]', '', 'g'
    )
  )),
  title_normalized = lower(trim(title)),
  dedup_fingerprint = lower(trim(
    regexp_replace(
      regexp_replace(company, '\s+(AB|Ltd|Limited|Inc|Corp|LLC|GmbH|AS|ApS|SAS|BV|NV|SA|Plc|Group)\s*$', '', 'gi'),
      '[&,\.]', '', 'g'
    )
  )) || '::' || lower(trim(title))
WHERE company_normalized IS NULL;

-- 6. Backfill all_sources for existing rows
UPDATE public.job_listings
SET all_sources = ARRAY[source]
WHERE all_sources = '{}' OR all_sources IS NULL;

-- 7. Backfill has_applied for existing rows where there's a matching application by URL
UPDATE public.job_listings jl
SET
  has_applied = true,
  applied_at = a.applied_at,
  application_id = a.id
FROM public.applications a
WHERE jl.user_id = a.user_id
  AND lower(jl.url) = lower(a.url)
  AND a.status != 'saved';

-- 8. Update applications to link back to job_listings where URL matches
UPDATE public.applications a
SET job_listing_id = jl.id
FROM public.job_listings jl
WHERE a.user_id = jl.user_id
  AND lower(a.url) = lower(jl.url)
  AND a.job_listing_id IS NULL;

-- 9. Helper: safely append to all_sources and all_urls arrays without duplicates
CREATE OR REPLACE FUNCTION public.append_job_listing_source(
  p_job_listing_id uuid,
  p_source text,
  p_url text
) RETURNS void AS $$
BEGIN
  UPDATE public.job_listings
  SET
    all_sources = CASE
      WHEN p_source = ANY(all_sources) THEN all_sources
      ELSE array_append(all_sources, p_source)
    END,
    all_urls = CASE
      WHEN p_url = ANY(all_urls) THEN all_urls
      ELSE array_append(all_urls, p_url)
    END
  WHERE id = p_job_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
