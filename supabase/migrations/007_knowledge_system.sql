-- ============================================================
-- Personal Knowledge System — Phase 9a
-- Document upload, knowledge items, and profile summary
-- ============================================================

-- uploaded_documents: raw files the user uploads about themselves
create table uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  filename text not null,
  file_type text not null,
  file_size integer,
  storage_path text not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'completed', 'failed')),
  processing_error text,
  extracted_text text,
  ai_summary text,
  document_type text,
  source_context text,
  extracted_item_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table uploaded_documents enable row level security;
create policy "Users manage own documents"
  on uploaded_documents for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_uploaded_docs_user on uploaded_documents(user_id);
create index idx_uploaded_docs_status on uploaded_documents(processing_status);


-- knowledge_items: structured knowledge extracted from documents, interviews, manual input
create table knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  category text not null
    check (category in ('fact', 'skill', 'achievement', 'story',
                        'value', 'preference', 'philosophy', 'self_assessment')),
  subcategory text,
  title text not null,
  content text not null,
  structured_data jsonb default '{}',
  tags text[] default '{}',
  confidence text not null default 'ai_inferred'
    check (confidence in ('user_confirmed', 'ai_inferred', 'imported')),
  source_type text not null
    check (source_type in ('document', 'interview', 'manual', 'application', 'profile_import')),
  source_document_ids uuid[] default '{}',
  source_interview_id uuid,
  is_active boolean default true,
  last_verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table knowledge_items enable row level security;
create policy "Users manage own knowledge"
  on knowledge_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_knowledge_user on knowledge_items(user_id);
create index idx_knowledge_category on knowledge_items(user_id, category);
create index idx_knowledge_tags on knowledge_items using gin(tags);
create index idx_knowledge_active on knowledge_items(user_id, is_active) where is_active = true;


-- knowledge_profile_summary: AI-generated synthesis of all knowledge
-- Regenerated whenever significant knowledge items are added/changed
create table knowledge_profile_summary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null unique,
  executive_summary text,
  key_strengths text[] default '{}',
  career_narrative text,
  leadership_style text,
  ideal_role_description text,
  unique_value_proposition text,
  knowledge_item_count integer default 0,
  completeness_scores jsonb default '{}',
  last_generated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table knowledge_profile_summary enable row level security;
create policy "Users manage own summary"
  on knowledge_profile_summary for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- Storage bucket and policies for knowledge documents
insert into storage.buckets (id, name, public) values ('knowledge-documents', 'knowledge-documents', false)
  on conflict (id) do nothing;

create policy "Users upload to own folder"
  on storage.objects for insert
  with check (bucket_id = 'knowledge-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users read own files"
  on storage.objects for select
  using (bucket_id = 'knowledge-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own files"
  on storage.objects for delete
  using (bucket_id = 'knowledge-documents' and auth.uid()::text = (storage.foldername(name))[1]);
