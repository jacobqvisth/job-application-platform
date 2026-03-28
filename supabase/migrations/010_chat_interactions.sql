-- ============================================================
-- Chat Interactions — Phase 10e
-- Tracks user interactions with AI suggestions, chips, and tools
-- Foundation for adaptive intelligence and learning
-- ============================================================

create table chat_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  conversation_id uuid references chat_conversations(id) on delete set null,
  interaction_type text not null check (interaction_type in (
    'suggestion_click',    -- clicked a context sidebar suggestion
    'chip_click',          -- clicked a quick action chip
    'morning_brief_action', -- clicked an action from morning brief
    'tool_invocation'      -- AI used a tool (automatic tracking)
  )),
  action_text text,        -- the label/text of what was clicked
  action_message text,     -- the message sent to chat
  tool_name text,          -- which tool was invoked (for tool_invocation type)
  metadata jsonb default '{}', -- flexible: stage, flow, context, etc.
  created_at timestamptz default now()
);

alter table chat_interactions enable row level security;
create policy "Users manage own interactions"
  on chat_interactions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_chat_interactions_user on chat_interactions(user_id, created_at desc);
create index idx_chat_interactions_type on chat_interactions(user_id, interaction_type, created_at desc);
