-- Create challenges table if it doesn't exist (it may have been created manually in the dashboard)
create table if not exists challenges (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references profiles(id) on delete cascade,
  host_name   text not null,
  host_side   text not null,  -- 'attacker' | 'defender'
  rules       text not null,
  board_size  int not null,
  created_at  timestamptz not null default now()
);

alter table challenges enable row level security;

-- Anyone can view open challenges
create policy "challenges_select"
  on challenges for select
  using (true);

-- Authenticated users can post a challenge
create policy "challenges_insert"
  on challenges for insert
  with check (auth.uid() = host_id);

-- Host can delete their own challenge (cancel)
create policy "challenges_delete_host"
  on challenges for delete
  using (auth.uid() = host_id);

-- Any authenticated user can delete any challenge (accept)
-- This is intentional: accepting atomically claims the row by deleting it.
-- Only the first concurrent DELETE on a given id returns a row — others get nothing.
create policy "challenges_delete_accept"
  on challenges for delete
  using (auth.role() = 'authenticated');

-- Also need: any authenticated user can insert into games when accepting a challenge
-- (the acceptor creates the games row, not just the host)
drop policy if exists "Players can insert games" on games;
create policy "Players can insert games"
  on games for insert
  with check (
    auth.uid() = attacker_id or auth.uid() = defender_id
  );

-- Also allow both players to read their game (select was previously missing an insert policy)
drop policy if exists "Anyone can read all games" on games;
create policy "Anyone can read all games"
  on games for select
  using (true);

-- Enable realtime on challenges
alter publication supabase_realtime add table challenges;
