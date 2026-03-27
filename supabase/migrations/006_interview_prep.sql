-- Interview prep packs: AI-generated per application
create table interview_prep_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  application_id uuid references applications(id) on delete cascade not null unique,
  company_brief text,
  likely_questions jsonb default '[]',
  -- [{category: 'behavioral'|'role-specific'|'motivation'|'technical', question: string, star_prompt: string|null}]
  key_themes jsonb default '[]',
  -- [string]
  model_used text,
  generated_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table interview_prep_packs enable row level security;

create policy "Users manage their own prep packs"
  on interview_prep_packs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_prep_packs_application_id on interview_prep_packs(application_id);
create index idx_prep_packs_user_id on interview_prep_packs(user_id);
