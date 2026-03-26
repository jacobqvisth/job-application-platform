-- screening_answers: stores all Q&A from application forms for future reuse
-- This is the foundation of the answer memory system
create table public.screening_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  application_id uuid references public.applications(id) on delete set null,
  question text not null,
  answer text not null,
  status text not null default 'approved'
    check (status in ('draft', 'approved')),
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.screening_answers enable row level security;

create policy "Users can manage own screening answers" on public.screening_answers
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_screening_answers_user_id on public.screening_answers(user_id);
create index idx_screening_answers_application_id on public.screening_answers(application_id);

create trigger set_updated_at before update on public.screening_answers
  for each row execute function public.update_updated_at();
