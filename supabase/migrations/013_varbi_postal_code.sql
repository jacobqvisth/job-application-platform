-- Migration 013: Add postal_code to user_profile_data
-- Needed for Varbi quick-apply form autofill (Phase S2)

alter table public.user_profile_data
  add column if not exists postal_code text;
