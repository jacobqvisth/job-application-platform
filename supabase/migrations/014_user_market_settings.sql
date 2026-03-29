-- Migration 014: Multi-market settings
-- Allows users to configure which country markets they're active in

CREATE TABLE public.user_market_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_code TEXT NOT NULL,           -- ISO 3166-1 alpha-2: 'SE', 'NO', 'GB', etc.
  is_primary BOOLEAN DEFAULT false,
  language_preference TEXT DEFAULT 'en', -- 'sv', 'en', 'no', 'de', etc.
  job_search_radius_km INTEGER DEFAULT 50,
  salary_currency TEXT DEFAULT 'SEK',
  resume_format TEXT DEFAULT 'international', -- 'swedish', 'international', 'german', etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, market_code)
);

ALTER TABLE public.user_market_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own market settings"
  ON public.user_market_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure only one primary market per user
CREATE UNIQUE INDEX idx_user_market_primary
  ON public.user_market_settings(user_id)
  WHERE is_primary = true;

-- Auto-create Sweden as primary market for existing users who have saved searches
INSERT INTO public.user_market_settings (user_id, market_code, is_primary, language_preference, salary_currency)
SELECT DISTINCT user_id, 'SE', true, 'sv', 'SEK'
FROM public.saved_searches
WHERE country = 'se'
ON CONFLICT DO NOTHING;
