-- Create canonical_questions table
create table canonical_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  canonical_text text not null,
  category text not null default 'other' check (category in (
    'behavioral', 'technical', 'motivational', 'situational',
    'salary', 'availability', 'why_us', 'why_role', 'other'
  )),
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table canonical_questions enable row level security;
create policy "Users can manage own canonical questions"
  on canonical_questions for all using (auth.uid() = user_id);

create index idx_canonical_questions_user_id on canonical_questions(user_id);
create index idx_canonical_questions_category on canonical_questions(category);

-- Add new columns to screening_answers
alter table screening_answers
  add column canonical_question_id uuid references canonical_questions(id) on delete set null,
  add column rating text default 'untested' check (rating in ('strong', 'good', 'needs_work', 'untested')),
  add column tone text default 'neutral' check (tone in ('formal', 'conversational', 'concise', 'detailed', 'neutral')),
  add column usage_count integer default 0;

create index idx_screening_answers_canonical on screening_answers(canonical_question_id);
create index idx_screening_answers_rating on screening_answers(rating);
