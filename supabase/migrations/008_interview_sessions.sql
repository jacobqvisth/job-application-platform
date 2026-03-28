-- ============================================================
-- Interview Sessions — Phase 9b
-- AI-conducted discovery interviews
-- ============================================================

create table interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  topic text not null,
  topic_label text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'paused')),
  messages jsonb not null default '[]',
  extracted_item_ids uuid[] default '{}',
  summary text,
  question_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table interview_sessions enable row level security;
create policy "Users manage own interviews"
  on interview_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_interview_sessions_user on interview_sessions(user_id);
create index idx_interview_sessions_status on interview_sessions(user_id, status);

-- Add source_interview_id to knowledge_items for linking
alter table knowledge_items add column if not exists source_interview_id uuid references interview_sessions(id);
