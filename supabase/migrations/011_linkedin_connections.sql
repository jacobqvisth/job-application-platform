-- LinkedIn connections (OAuth tokens for Share API)
create table linkedin_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  linkedin_id text not null,
  email text,
  name text,
  profile_url text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz not null,
  scopes text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Each user can only have one LinkedIn connection
create unique index linkedin_connections_user_id_idx on linkedin_connections(user_id);

-- RLS: users can only access their own connection
alter table linkedin_connections enable row level security;

create policy "Users can view own LinkedIn connection"
  on linkedin_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own LinkedIn connection"
  on linkedin_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own LinkedIn connection"
  on linkedin_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete own LinkedIn connection"
  on linkedin_connections for delete
  using (auth.uid() = user_id);
