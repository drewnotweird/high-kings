# High Kings — Multiplayer & Social Features

Last updated: 2026-07-03 (session 2)

---

## Status

| Phase | Status |
|---|---|
| Phase 1 — Auth & Profiles | ✅ Done |
| Phase 1b — Stats for vs-AI games | ✅ Done |
| Phase 2 — Online Matches (Lobby) | ✅ Done |
| Phase 3 — ELO & Leaderboards | ✅ Done |
| Phase 4 — Social & Polish | Not started |

---

## Stack

| Layer | Choice |
|---|---|
| Backend / DB | Supabase |
| Auth | Supabase Auth (email + password) |
| Realtime moves | Supabase Realtime (WebSocket broadcast) |
| Lobby | Supabase Realtime (postgres_changes on `challenges` table) |
| ELO | Postgres trigger (`update_elo`) |
| Hosting | Fasthosts (unchanged) |

---

## ✅ Phase 1 — Auth & Profiles

Sign up with email + password. Display name chosen on first login. Auth is opt-in — guest play works without an account. Stats only recorded for logged-in users.

**Live:**
- `AuthModal.tsx` — login / signup / email-confirm / username-setup / forgot-password
- `userId`, `username`, `elo`, `authReady` in Zustand store
- Session restored on mount via `supabase.auth.getSession()`; synced via `onAuthStateChange` (fetches `username` + `elo` on every auth event)
- `profiles` table (id, username, elo, created_at)
- Profile screen — username (editable), ELO rating, win/loss record, Play Online button, Log Out

---

## ✅ Phase 1b — VS-Machine Stats

**Live:**
- `game_results` table (id, user_id, opponent_type, result, rules, board_size, created_at)
- Insert fires on `winner` change when logged in and `playerMode !== '2player'`
- Profile screen groups results client-side by (rules, board_size, opponent_type)
- RLS: users can only read/insert their own rows

---

## ✅ Phase 2 — Online Matches (Lobby)

Two logged-in players find each other via a lobby and play in real time. No server-side game engine — `hnefatafl.ts` logic runs on both clients.

### How it works

**Hosting a challenge:**
1. Player opens the Game menu → sets Play to Online → Start, or taps Play Online in their profile.
2. The lobby panel opens. Player can see all open challenges from other users.
3. Player clicks **Host Challenge** — a row is inserted into the `challenges` table with their chosen rules, board size, and side.
4. The lobby panel shows a spinner while waiting.

**Accepting a challenge:**
1. Other logged-in players see the challenge appear in real time (Realtime postgres_changes on `challenges`).
2. Offline players (playing vs machine) see a challenge invite notification in the bottom-centre of the screen.
3. Player clicks **Accept** — the `challenges` row is deleted atomically first. If two players race to accept, only one succeeds (the delete returns a row for the winner; the other gets nothing and bails).
4. The winner inserts a `games` row and calls `onGameStart`.
5. The host is notified via a Realtime postgres_changes INSERT on `games` filtered to their user ID.

**Playing:**
- Both players join `game:{gameId}` Realtime broadcast channel.
- Local moves broadcast `{ type: 'move', seq, pieceId, toRow, toCol }`.
- Opponent receives broadcast → `machineMove(pieceId, toRow, toCol)`.
- Seq validation: gap → `resync_request` → full `pieces` + seq reply.

**Disconnect:**
- Realtime presence `leave` → 30-second countdown.
- On reconnect (`join`), game resumes from local state.
- After timeout, waiting player wins by abandonment; `games` row updated.

**Game end:**
- App.tsx detects `winner !== null` while `onlineStatus.type === 'matched'`.
- Calls `endGame(winnerId)` — `winnerId` is the actual user ID of the winner (derived from `opponentId` stored in `OnlineStatus`).
- Updates `games` table with `status: 'completed'`, `winner_id`, `ended_at` — chained with `.then()` so supabase-js actually executes the HTTP request.
- ELO trigger fires server-side.
- Hint and Undo buttons are hidden while an online match is active.

### DB Schema

```sql
create table challenges (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references profiles(id) on delete cascade,
  host_name   text not null,
  host_side   text not null,  -- 'attacker' | 'defender'
  rules       text not null,
  board_size  int not null,
  created_at  timestamptz not null default now()
);

create table games (
  id           uuid primary key default gen_random_uuid(),
  attacker_id  uuid references profiles(id) on delete cascade,
  defender_id  uuid references profiles(id) on delete cascade,
  rules        text not null,
  board_size   int not null,
  status       text not null default 'active',  -- 'active' | 'completed' | 'abandoned'
  winner_id    uuid references profiles(id) on delete set null,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);
```

Realtime enabled on both tables.

### RLS policies required

`challenges` table needs **two** delete policies:
- `challenges_delete_host` — `using (auth.uid() = host_id)` for cancel
- `challenges_delete_accept` — `using (auth.role() = 'authenticated')` so any logged-in user can atomically claim a challenge by deleting it

`games` table needs an insert policy:
- `using (auth.uid() = attacker_id or auth.uid() = defender_id)` — the acceptor creates the games row, not just the host

Migration: `supabase/migrations/004_challenges_table.sql`

### Key files

- `src/hooks/useLobby.ts` — manages challenges state, Realtime subscriptions, `hostChallenge`, `cancelChallenge`, `acceptChallenge`
- `src/hooks/useOnlineGame.ts` — `startGame`, `sendMove`, `endGame`; broadcast channel; presence; disconnect timer
- `src/components/ui/LobbyPanel.tsx` — lobby UI

---

## ✅ Phase 3 — ELO & Leaderboards

### ELO system

Calculated server-side via a Postgres trigger (`update_elo` on `games` AFTER UPDATE).

**K-factor:**
| Condition | K |
|---|---|
| < 30 completed games (provisional) | 40 |
| Standard (< 2000 ELO) | 32 |
| Master (≥ 2000 ELO) | 16 |
| Repeat opponent (seen in last 5 games) | capped at 20 |

**Side bias:** `side_bias` table allows per-variant attacker/defender bias adjustments. Defaults to 0 (neutral) until win-rate data accumulates.

**ELO floor:** 100 (cannot go below).

**Formula:** `E = 1 / (1 + 10^((opp_elo - my_elo) / 400))`, `R' = R + K * (S - E)`

### Leaderboard

- All registered players ranked by ELO descending.
- Accessible from the footer (Leaderboard link).
- Highlights the current user's row.
- Shows "Your rank #X" banner when logged in.

### Score panels

- Show player name and ELO whenever logged in (vs machine or online).
- Online: both players' names and ELO shown.
- Panels are content-sized (fit to content — icon only when no name/ELO).

### DB

```sql
-- ELO column on profiles
alter table profiles add column elo int not null default 1000;

-- Side bias (populate as data accumulates)
create table side_bias (
  rules text primary key,
  attacker_bias float not null default 0
);
```

Migration: `supabase/migrations/003_elo_improvements.sql`

---

## Phase 4 — Social & Polish (Not started)

### Match History
Last 50 games: opponent, outcome, board, date, ELO change. Tapping enters Replay mode.

### Game Replay
Powered by the `moves` table. Step through with prev/next controls.

### Quick Chat
Pre-set messages only. Broadcast as `chat` event on the Realtime channel.

### Badges / Achievements
First Win, Win Streaks, Veteran, Specialist (attacker/defender), played every variant.

### Spectate
Third client subscribes to `game:{id}` as observer (read-only).

---

## Open Questions

1. **Per-variant ELO** — one global rating, or separate ELO per ruleset?
2. **Abandonment rule** — does a disconnect loss affect ELO, or is the game voided?
3. **Rate limiting** — cap games per hour to prevent stat farming?
4. **Side bias values** — populate `side_bias` table once enough games are recorded.
