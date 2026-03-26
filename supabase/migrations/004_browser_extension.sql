-- Migration 004: Browser Extension support
-- Adds contact details to user_profile_data and creates form_field_mappings table

-- Add contact/personal details to user_profile_data
-- These are the fields the extension needs for autofill
alter table public.user_profile_data
  add column if not exists phone text,
  add column if not exists address_line1 text,
  add column if not exists city text,
  add column if not exists country text default 'United Kingdom',
  add column if not exists linkedin_url text,
  add column if not exists website_url text,
  add column if not exists github_url text;

-- form_field_mappings: stores learned + user-corrected field→profile mappings
-- When Jacob corrects a wrong autofill, the extension records what the correct mapping is.
-- Next time it encounters the same field on the same ATS, it uses the corrected mapping.
create table public.form_field_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  ats_type text not null check (ats_type in ('workday', 'greenhouse', 'lever')),
  field_identifier text not null,    -- CSS selector or label text used to locate the field
  profile_key text not null,         -- which profile field maps here (e.g. 'first_name', 'phone', 'linkedin_url')
  is_user_corrected boolean default false, -- true once the user has manually corrected this mapping
  correction_count integer default 0,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, ats_type, field_identifier)
);

alter table public.form_field_mappings enable row level security;

create policy "Users can manage own field mappings" on public.form_field_mappings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_form_field_mappings_user_ats on public.form_field_mappings(user_id, ats_type);

create trigger set_updated_at_form_field_mappings before update on public.form_field_mappings
  for each row execute function public.update_updated_at();
