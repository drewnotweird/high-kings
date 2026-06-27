-- Online match tables for Phase 2

create table games (
  id           uuid primary key default gen_random_uuid(),
  attacker_id  uuid not null references profiles(id),
  defender_id  uuid not null references profiles(id),
  rules        text not null,
  board_size   int not null,
  status       text not null default 'active',  -- 'active' | 'completed' | 'abandoned'
  winner_id    uuid references profiles(id),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);

create table moves (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games(id) on delete cascade,
  player_id  uuid not null references profiles(id),
  piece_id   text not null,
  from_row   int not null,
  from_col   int not null,
  to_row     int not null,
  to_col     int not null,
  seq        int not null,
  created_at timestamptz not null default now(),
  unique(game_id, seq)
);

create table lobby (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references profiles(id) unique,
  rules       text not null,
  board_size  int not null,
  queued_at   timestamptz not null default now()
);

-- RLS
alter table games enable row level security;
alter table moves enable row level security;
alter table lobby enable row level security;

create policy "Players can view their own games"
  on games for select
  using (auth.uid() = attacker_id or auth.uid() = defender_id);

create policy "Players can update their own games"
  on games for update
  using (auth.uid() = attacker_id or auth.uid() = defender_id);

create policy "Players can view moves in their games"
  on moves for select
  using (
    exists (
      select 1 from games
      where games.id = moves.game_id
        and (games.attacker_id = auth.uid() or games.defender_id = auth.uid())
    )
  );

create policy "Players can insert moves in their games"
  on moves for insert
  with check (
    auth.uid() = player_id
    and exists (
      select 1 from games
      where games.id = moves.game_id
        and (games.attacker_id = auth.uid() or games.defender_id = auth.uid())
    )
  );

create policy "Players can manage their own lobby row"
  on lobby for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

-- Enable realtime on games and lobby so clients get notified
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table lobby;
