-- Supabase/PostgreSQL schema for the BRGX application
-- This schema models users, training progress, action logs and the real-time queue list.

create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table training_progress (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  mission_id text not null,
  completed_at timestamptz not null default now(),
  constraint training_progress_user_mission_unique unique(user_id, mission_id)
);

create table action_logs (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  action_type text not null,
  reference_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table queue_list (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security (RLS) comments
-- Enable RLS on all tables for security in Supabase.
alter table profiles enable row level security;
alter table training_progress enable row level security;
alter table action_logs enable row level security;
alter table queue_list enable row level security;

-- Example RLS policies for authenticated users.
-- In Supabase, auth.uid() returns the current user's UUID.

create policy profiles_allow_self_access on profiles
  for select using (auth.uid() = id);

create policy training_progress_owner on training_progress
  for all using (auth.uid() = user_id);

create policy action_logs_owner on action_logs
  for all using (auth.uid() = user_id);

create policy queue_list_owner on queue_list
  for all using (auth.uid() = user_id);

-- Optionally, allow queue list visibility for real-time consumers.
-- create policy queue_list_public on queue_list
--   for select using (true);
