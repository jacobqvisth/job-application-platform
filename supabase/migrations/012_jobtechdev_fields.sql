-- Add new columns for JobTechDev-enriched data
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS ats_type text;
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS apply_url text;
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS occupation_field text;
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS deadline timestamptz;
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS required_skills text[];
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS number_of_vacancies integer;

-- Update table comment to reflect multiple sources
COMMENT ON TABLE public.job_listings IS 'Cached job listings from external sources (JobTechDev, Adzuna)';

-- Update default source for saved_searches to Sweden
ALTER TABLE public.saved_searches ALTER COLUMN country SET DEFAULT 'se';
