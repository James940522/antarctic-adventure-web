-- STEP 7: run manually in the SQL Editor of the new Supabase project.
-- PostgreSQL 15+. This file does not create a browser-accessible write policy.
begin;

create extension if not exists pgcrypto;

create table if not exists public.game_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique,
  player_id uuid not null,
  nickname varchar(12) not null
    check (char_length(btrim(nickname)) between 2 and 12),
  score integer not null check (score >= 0),
  stage integer not null default 1 check (stage >= 1),
  distance integer not null default 0 check (distance >= 0),
  play_time integer not null default 0 check (play_time >= 0),
  created_at timestamptz not null default now()
);

create index if not exists game_records_score_idx
  on public.game_records (score desc, stage desc, distance desc, created_at asc);
create index if not exists game_records_player_idx
  on public.game_records (player_id, score desc);

alter table public.game_records enable row level security;

-- A view otherwise runs with its owner's permissions and can bypass table RLS.
create or replace view public.leaderboard
with (security_invoker = true) as
with ranked_records as (
  select player_id, nickname, score, stage, distance, play_time, created_at,
    row_number() over (
      partition by player_id
      order by score desc, stage desc, distance desc, created_at asc, id asc
    ) as player_record_rank
  from public.game_records
)
select player_id, nickname, score, stage, distance, play_time, created_at
from ranked_records
where player_record_rank = 1;

-- Browser -> Next.js Route Handler -> server key -> database.
-- No anon/authenticated INSERT or SELECT policies are installed.
revoke all on table public.game_records from public, anon, authenticated;
revoke all on table public.leaderboard from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert on table public.game_records to service_role;
grant select on table public.leaderboard to service_role;

commit;
