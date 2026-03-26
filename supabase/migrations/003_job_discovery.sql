-- saved_searches: user-defined job search queries, optionally run daily by cron
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  query text not null,          -- keywords / job title
  location text,                -- e.g. "London", "New York", "" for anywhere
  remote_only boolean default false,
  salary_min integer,           -- annual, in local currency
  country text default 'gb',    -- Adzuna country code: gb, us, de, nl, ca, au, etc.
  is_active boolean default true,  -- whether the daily cron should run this search
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.saved_searches enable row level security;

create policy "Users can manage own saved searches" on public.saved_searches
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_saved_searches_user_id on public.saved_searches(user_id);

create trigger set_updated_at_saved_searches before update on public.saved_searches
  for each row execute function public.update_updated_at();


-- job_listings: cached job results surfaced by the daily cron
-- Live on-demand searches do NOT write here — they are shown directly from the API response.
-- Only the cron writes here, so users see "discovered while you were away" listings.
create table public.job_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  saved_search_id uuid references public.saved_searches(id) on delete set null,
  external_id text not null,           -- Adzuna listing ID
  source text not null default 'adzuna',
  title text not null,
  company text not null,
  location text,
  description text,
  url text not null,
  salary_min numeric,
  salary_max numeric,
  remote_type text check (remote_type in ('remote', 'hybrid', 'onsite', 'unknown')),
  posted_at timestamptz,
  match_score integer default 0,       -- 0–100, computed on ingest
  is_saved boolean default false,      -- true once user saves it to applications
  created_at timestamptz default now(),
  unique(user_id, external_id, source)
);

alter table public.job_listings enable row level security;

create policy "Users can read own job listings" on public.job_listings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_job_listings_user_id on public.job_listings(user_id);
create index idx_job_listings_match_score on public.job_listings(user_id, match_score desc);
create index idx_job_listings_is_saved on public.job_listings(user_id, is_saved);
