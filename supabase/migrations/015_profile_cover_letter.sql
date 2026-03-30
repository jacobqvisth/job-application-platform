-- Migration 015: Add cover_letter to user_profile_data for extension autofill
-- Used by the ReachMee adapter to fill prof_personalmotivation textarea
alter table public.user_profile_data
  add column if not exists cover_letter text;
