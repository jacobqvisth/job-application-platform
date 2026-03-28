-- ============================================================
-- Chat Conversations — Phase 10d
-- Persistent chat history with AI-generated titles
-- ============================================================

-- Conversations table
create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  title text not null default 'New conversation',
  last_message_at timestamptz default now(),
  message_count integer default 0,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table chat_conversations enable row level security;
create policy "Users manage own conversations"
  on chat_conversations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_chat_conversations_user on chat_conversations(user_id, last_message_at desc);
create index idx_chat_conversations_active on chat_conversations(user_id, is_archived, last_message_at desc);

-- Messages table
-- Stores the full AI SDK message format as JSONB for tool calls, parts, etc.
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  role text not null check (role in ('user', 'assistant')),
  content text,      -- plain text content for search/display
  message_data jsonb not null, -- full AI SDK UIMessage serialized
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;
create policy "Users manage own messages"
  on chat_messages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_chat_messages_conversation on chat_messages(conversation_id, created_at asc);
create index idx_chat_messages_user on chat_messages(user_id);
