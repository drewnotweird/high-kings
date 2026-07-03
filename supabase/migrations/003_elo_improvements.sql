-- Side bias table — populate as win-rate data accumulates per variant.
-- attacker_bias > 0 means attackers win more than expected at equal ELO.
-- e.g. 0.05 means attackers win ~55% of games at equal rating.
create table if not exists side_bias (
  rules text primary key,
  attacker_bias float not null default 0
);

-- Improved ELO trigger
create or replace function update_elo() returns trigger as $$
declare
  att_elo   int;
  def_elo   int;
  att_games bigint;
  def_games bigint;
  att_k     float;
  def_k     float;
  exp_att   float;
  exp_def   float;
  att_score float;
  def_score float;
  bias      float := 0;
  is_repeat bool  := false;
begin
  if NEW.status != 'completed' or OLD.status = 'completed' then return NEW; end if;

  -- Current ratings
  select elo into att_elo from profiles where id = NEW.attacker_id;
  select elo into def_elo from profiles where id = NEW.defender_id;

  -- Completed games played (excludes this one) — determines provisional status
  select count(*) into att_games from games
    where (attacker_id = NEW.attacker_id or defender_id = NEW.attacker_id)
      and status = 'completed' and id != NEW.id;
  select count(*) into def_games from games
    where (attacker_id = NEW.defender_id or defender_id = NEW.defender_id)
      and status = 'completed' and id != NEW.id;

  -- K-factor: 40 provisional (<30 games), 16 master (≥2000), 32 standard
  att_k := case when att_games < 30 then 40 when att_elo >= 2000 then 16 else 32 end;
  def_k := case when def_games < 30 then 40 when def_elo >= 2000 then 16 else 32 end;

  -- Repeat match guard: cap K at 20 if these two have faced each other
  -- within either player's last 5 completed games
  select exists(
    select 1 from games g
    where
      ((g.attacker_id = NEW.attacker_id and g.defender_id = NEW.defender_id)
       or (g.attacker_id = NEW.defender_id and g.defender_id = NEW.attacker_id))
      and g.status = 'completed'
      and g.id != NEW.id
      and g.id in (
        select id from games
        where (attacker_id = NEW.attacker_id or defender_id = NEW.attacker_id)
          and status = 'completed' and id != NEW.id
        order by ended_at desc limit 5
      )
  ) into is_repeat;

  if is_repeat then
    att_k := least(att_k, 20);
    def_k := least(def_k, 20);
  end if;

  -- Side bias adjustment for this variant
  select coalesce(attacker_bias, 0) into bias from side_bias where rules = NEW.rules;

  -- Expected scores with bias, clamped to avoid degenerate values
  exp_att := greatest(0.01, least(0.99, 1.0 / (1 + power(10, (def_elo - att_elo) / 400.0)) + bias));
  exp_def := 1.0 - exp_att;

  -- Actual scores
  if NEW.winner_id = NEW.attacker_id then
    att_score := 1; def_score := 0;
  elsif NEW.winner_id = NEW.defender_id then
    att_score := 0; def_score := 1;
  else
    att_score := 0.5; def_score := 0.5;
  end if;

  -- Apply ELO changes (floor at 100 to prevent negative ratings)
  update profiles
    set elo = greatest(100, elo + round(att_k * (att_score - exp_att))::int)
    where id = NEW.attacker_id;
  update profiles
    set elo = greatest(100, elo + round(def_k * (def_score - exp_def))::int)
    where id = NEW.defender_id;

  return NEW;
end;
$$ language plpgsql security definer;
