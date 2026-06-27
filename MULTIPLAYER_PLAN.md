# High Kings — Multiplayer & Social Features Plan

Last updated: 2026-06-27

---

## Status

| Phase | Status |
|---|---|
| Phase 1 — Auth & Profiles | ✅ Done |
| Phase 1b — Stats for vs-AI games | ✅ Done |
| Phase 2 — Online Matches | 🔄 In Progress |
| Phase 3 — ELO & Leaderboards | Not started |
| Phase 4 — Social & Polish | Not started |

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend / DB | Supabase | Auth, DB, Realtime, Edge Functions in one project |
| Auth | Supabase Auth | Email + Google OAuth built-in |
| Realtime moves | Supabase Realtime (WebSocket broadcast) | Peer-to-peer move sync without a game server |
| Matchmaking | Supabase Edge Function | Serverless, no infra to maintain |
| Client SDK | `@supabase/supabase-js` | Single client covers all of the above |
| Hosting | Existing (unchanged) | No backend deployment needed |

---

## ✅ Phase 1 — Auth & Profiles (Done)

Sign up with email + password. Display name chosen on first login. Auth is opt-in — guest play works without an account. Unauthenticated players can play locally; stats are only recorded for logged-in users.

**What's live:**
- `AuthModal.tsx` — login / signup / email-confirm / username-setup / forgot-password
- `userId`, `username`, `authReady` in Zustand store
- Session restored on mount via `supabase.auth.getSession()`; kept in sync via `onAuthStateChange`
- `profiles` table in Supabase (id, username, avatar_url, created_at)
- Username shown in menu overlay; sign out from Profile screen

---

## ✅ Phase 1b — VS-Machine Stats (Done)

Game results recorded to Supabase and displayed in the Profile screen.

**What's live:**
- `game_results` table (id, user_id, opponent_type, result, rules, board_size, created_at)
- Insert fires on `winner` change when logged in and not in 2-player mode
- Profile screen shows W/L per variant per opponent type, grouped client-side
- RLS: users can only read/insert their own rows

---

## 🔄 Phase 2 — Online Matches (In Progress)

### Goal
Two logged-in players can find each other and play a live game in real time. No server-side game engine — the existing `hnefatafl.ts` logic runs on both clients.

### What's Done

**Infrastructure (all live in Supabase):**
- `games`, `moves`, `lobby` tables with RLS — migration `002_online_matches.sql` applied
- Realtime enabled on `games` and `lobby` tables
- `matchmaking` Edge Function deployed

**Client code (all wired into App.tsx):**
- `useOnlineGame` hook — `findMatch`, `cancelSearch`, `sendMove`, `endGame`; poll-based matchmaking with 3s interval; Realtime channel subscription; seq validation + resync; presence-based disconnect detection (30s countdown)
- `FindMatchModal` component — Board/Rules pickers, Find Opponent button, searching state + cancel, matched/disconnected states
- `MenuOverlay` Play mode cycler — `Online` | `Vs Machine` | `Take turns`; tapping Start with Online triggers `findMatch` immediately
- Match header shown during online games (opponent name, turn indicator)
- Move broadcast: App.tsx watches `lastMove` store field and calls `sendMove` after each local move
- Move receive: opponent broadcasts → `machineMove(pieceId, toRow, toCol)`

### Pending

- Full end-to-end testing with two real users
- Match header polish (ELO display — needs Phase 3)
- Disconnect handling UX (banner is wired but needs live testing)
- Play Again flow after match ends
- `beforeunload` lobby cleanup

---

### User Experience (as implemented)

#### Finding a match

1. Player sets **Play: Online** in settings panel and taps **Start**.
2. `FindMatchModal` appears over the menu. Search starts immediately (no idle settings screen when coming from the menu — settings were already chosen).
3. Modal shows spinner + "Searching for opponent…" + Cancel.
4. Client calls `matchmaking` Edge Function with `{ rules, boardSize }`.
5. **If an opponent is waiting:** Edge Function creates a `games` row, assigns sides randomly, returns `{ gameId, side }`. Both clients call `handleMatched` → apply settings to store → `resetGame()` → join Realtime channel. Modal and menu close.
6. **If no one is waiting:** Client enters `lobby` table. Poll fires every 3s. After 5 minutes, poll stops, lobby row removed, status resets to idle.

**Cancel:** clears poll, calls cancel endpoint (removes lobby row), closes modal, returns user to settings. Original game state is intact — settings were not applied to the store.

#### Playing

- `movePiece()` executes locally, sets `lastMove` in store → App.tsx broadcasts `{ type: 'move', seq, pieceId, toRow, toCol }` on `game:{gameId}` channel.
- Opponent receives broadcast → `machineMove(pieceId, toRow, toCol)` — same action the AI uses, so all capture logic and animations play identically.
- Seq check: gap or duplicate → `resync_request` → other client replies with full `pieces` + seq.

#### Disconnect

- Realtime presence `leave` → 30s countdown shown in modal → if no reconnect, `games` row updated to `abandoned`, waiting player wins.
- On reconnect (`join` event), game resumes from local state.

#### Game end

- App.tsx detects `winner !== null` while `onlineStatus.type === 'matched'` → calls `endGame(winnerId)` → updates `games` table, cleans up channel.

---

### Architecture

**Authoritative client model** — the moving player is the source of truth for each move. No server validates moves. Cheating prevention is out of scope for v1.

**Move event:**
```ts
{
  type: 'move'
  seq: number       // monotonically increasing per game, starting at 1
  pieceId: string
  toRow: number
  toCol: number
}
```

**Other event types:**
```ts
{ type: 'resync_request' }
{ type: 'resync', pieces: Piece[], seq: number }
{ type: 'opponent_name', name: string }
{ type: 'chat', message: string }   // Phase 4 only
```

**Realtime channel:** `game:{gameId}` — both players subscribe immediately after match is made. Broadcast mode (not Postgres changes) — low latency, ephemeral.

---

### DB Schema (live)

```sql
create table games (
  id           uuid primary key default gen_random_uuid(),
  attacker_id  uuid not null references profiles(id),
  defender_id  uuid not null references profiles(id),
  rules        text not null,
  board_size   int not null,
  status       text not null default 'active',   -- 'active' | 'completed' | 'abandoned'
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
```

RLS on all tables: players can only read/write rows where they are a participant.

---

### Edge Cases

| Scenario | Handling |
|---|---|
| No opponent available | 5-minute timeout; lobby row cleaned via cancel endpoint; status resets to idle |
| Player disconnects mid-game | 30-second grace via Realtime presence; opponent wins by abandonment after timeout |
| Move arrives out of order | Seq check → resync_request → full state reply |
| Both players submit result simultaneously | `update ... where status = 'active'` — first write wins |
| Player closes tab mid-wait | Cancel endpoint removes lobby row; `beforeunload` handler pending |
| Cheating (modified client) | Out of scope v1 |
| Stale poll after cancel | `handleMatched` checks `state.current.pollInterval !== null` before applying |

---

## Phase 3 — ELO & Leaderboards

Record ELO per player. Show rankings.

### ELO Calculation

Standard ELO, K=32 for first 30 games, K=16 thereafter. Starting ELO: 1000.

```ts
function updateElo(winnerElo: number, loserElo: number, k: number) {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400))
  return {
    winner: Math.round(winnerElo + k * (1 - expected)),
    loser:  Math.round(loserElo  + k * (0 - (1 - expected))),
  }
}
```

### DB Schema

```sql
create table player_stats (
  player_id    uuid references profiles(id),
  rules        text not null default 'all',  -- 'all' = global; or specific ruleset
  wins         int default 0,
  losses       int default 0,
  att_wins     int default 0,
  def_wins     int default 0,
  streak       int default 0,
  best_streak  int default 0,
  elo          int default 1000,
  updated_at   timestamptz default now(),
  primary key (player_id, rules)
);
```

### Implementation

1. Create `player_stats` table
2. Write `update_stats` Edge Function — called after each online game, updates ELO + counters for both players
3. Build Leaderboard screen — Global ELO / By Variant / Win Rate tabs
4. Show ELO in Find Match modal and match header
5. Show ELO change on WinnerOverlay after online game

---

## Phase 4 — Social & Polish

### Challenge a Friend
Player shares a link or enters opponent's username. Edge Function creates a pending game; opponent sees an invite on login.

### Match History
Last 50 games list: opponent, outcome, board, date, ELO change. Tapping enters Replay mode.

### Game Replay
Powered by the `moves` table (no extra schema). Step through moves with prev/next controls. Reuses existing board rendering.

### Badges / Achievements
```sql
create table badges (
  player_id  uuid references profiles(id),
  badge_key  text not null,
  earned_at  timestamptz default now(),
  primary key (player_id, badge_key)
);
```
Awarded inside `update_stats` Edge Function:
- First Win, 10 Wins, 50 Wins, 100 Wins
- Win Streak of 3, 5, 10
- Veteran (50 games played)
- Attacker Specialist (20 attacker wins), Defender Specialist (20 defender wins)
- Played every variant

### Spectate
Third client subscribes to `game:{id}` as observer (read-only). "Watch live" link from active game screen. No extra schema.

### Quick Chat
Pre-set messages only — no free text, no moderation needed. Broadcast as a `chat` event on the Realtime channel.

---

## Open Questions (decide before Phase 2)

1. **Ranked vs casual** — do we want separate ELO queues, or one queue for everything?
2. **Per-variant ELO** — one global rating, or separate ELO per ruleset? Per-variant is fairer but much more complex to display.
3. **Abandonment rule** — does a disconnect loss count toward ELO, or is the game voided?
4. **Rate limiting** — cap games per hour to prevent stat farming?
5. **Guest stats** — record wins locally for unauthed players and merge on sign-up?
