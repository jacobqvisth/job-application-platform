-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (auto-populated on signup)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Applications table
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  company text not null,
  role text not null,
  url text,
  status text not null default 'saved'
    check (status in ('saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn')),
  applied_at timestamptz,
  notes text,
  job_description text,
  cover_letter text,
  salary_range text,
  location text,
  remote_type text check (remote_type in ('remote', 'hybrid', 'onsite', null)),
  contact_name text,
  contact_email text,
  next_followup_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Application events timeline
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade not null,
  event_type text not null check (event_type in ('status_change', 'email_received', 'email_sent', 'note', 'interview_scheduled', 'followup_reminder')),
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;

-- Profiles: users can only read/update their own
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Applications: users can CRUD their own
create policy "Users can view own applications" on public.applications
  for select using (auth.uid() = user_id);
create policy "Users can create own applications" on public.applications
  for insert with check (auth.uid() = user_id);
create policy "Users can update own applications" on public.applications
  for update using (auth.uid() = user_id);
create policy "Users can delete own applications" on public.applications
  for delete using (auth.uid() = user_id);

-- Application events: users can CRUD events for their own applications
create policy "Users can view own application events" on public.application_events
  for select using (
    exists (
      select 1 from public.applications
      where applications.id = application_events.application_id
      and applications.user_id = auth.uid()
    )
  );
create policy "Users can create own application events" on public.application_events
  for insert with check (
    exists (
      select 1 from public.applications
      where applications.id = application_events.application_id
      and applications.user_id = auth.uid()
    )
  );

-- Indexes
create index idx_applications_user_id on public.applications(user_id);
create index idx_applications_status on public.applications(status);
create index idx_application_events_application_id on public.application_events(application_id);

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.applications
  for each row execute function public.update_updated_at();
