-- Attach update_elo() to the games table.
--
-- 003_elo_improvements.sql defines update_elo() and re-defines it with the
-- K-factor and repeat-opponent rules, but no migration ever ran CREATE TRIGGER,
-- so the function has never been attached to anything. Online games have been
-- completing with a winner recorded and no rating change: verified on
-- 2026-09-06 with a Brandub game between two accounts rated 1099 and 1040,
-- which should have moved them by 13-17 points and moved them by zero.
--
-- AFTER UPDATE: the function guards on `NEW.status = 'completed' and
-- OLD.status <> 'completed'`, so it needs OLD, and it performs its own writes
-- to profiles (as SECURITY DEFINER, so RLS does not block it). An AFTER trigger
-- ignores the returned NEW, which is harmless.

drop trigger if exists games_update_elo on games;

create trigger games_update_elo
  after update on games
  for each row
  execute function update_elo();
