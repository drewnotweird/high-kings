-- game_results: one row per finished vs-machine game for a logged-in player
create table if not exists game_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  opponent_type text not null check (opponent_type in ('machine', 'human')),
  result       text not null check (result in ('win', 'loss')),
  rules        text not null,
  board_size   int  not null,
  created_at   timestamptz not null default now()
);

-- Row-level security: players can only see and insert their own rows
alter table game_results enable row level security;

create policy "Users can insert own results"
  on game_results for insert
  with check (auth.uid() = user_id);

create policy "Users can read own results"
  on game_results for select
  using (auth.uid() = user_id);

-- Index to speed up profile stats queries
create index if not exists game_results_user_id_idx on game_results (user_id);
