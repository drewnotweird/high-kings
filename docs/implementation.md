# High Kings — Implementation Notes

Last updated: 2026-07-16 (performance & discoverability overhaul)

---

## Stack

| Layer | Library | Version |
|---|---|---|
| Build | Vite | ^8 |
| UI framework | React | ^19 |
| Language | TypeScript | ~6 |
| 3D rendering | React Three Fiber (R3F) | ^9.6.1 |
| Three.js | three | ^0.184 |
| R3F helpers | @react-three/drei | ^10 |
| State | Zustand | ^5 |
| Backend / Auth / DB | Supabase | ^2 |
| Hosting | Fasthosts (FTP via GitHub Actions) | — |

---

## File Map

```
src/
  App.tsx                      — root component; game orchestration, online flow, URL params (~560 lines)
  main.tsx                     — React root mount

  styles/
    ui.css                     — all UI chrome CSS (was the fireCSS template string in App.tsx)

  game/
    hnefatafl.ts               — all game logic (rules, moves, captures, config)
    ai.ts                      — AI engine: iterative-deepening minimax + alpha-beta (see README)
    aiWorker.ts                — Web Worker host for getBestMove
    aiClient.ts                — requestBestMove(params): Promise<AiMove|null>
    variants.ts                — BOARD_SIZE_RULES / ALL_RULES / slug helpers for ?rules= deep links

  store/
    gameStore.ts               — Zustand store (persist middleware); useGameSlice selector helper

  hooks/
    useOnlineGame.ts           — online match hook (startGame, watchGame, stopWatching, sendMove, endGame)
    useLobby.ts                — lobby state, Realtime subscriptions, host/cancel/accept, active games list
    useTabVisible.ts           — document.visibilitychange → pauses canvas frame loops

  components/
    board/
      Scene.tsx                — R3F Canvas, lights, camera, menuPhase state machine
      Board.tsx                — merged tile geometry + texture atlas, valid-move orbs, board click handling
      Board2D.tsx              — SVG power-saving fallback board
    pieces/
      Piece.tsx                — individual mesh for the King only
      PiecesLayer.tsx          — InstancedMesh for all attacker/defender pieces
    ui/
      buttons.tsx              — icon buttons (aria-labelled), Toggle, Cycler, Mist/Ember sprites
      MenuOverlay.tsx          — setup menu (settings panel)
      overlays.tsx             — ScorePanel, WinnerOverlay, RoleSelectOverlay, RepetitionWarning, GuestLoginModal
      ScrollPage.tsx           — parchment scroll chrome + CreditsScroll
      ProfileScroll.tsx        — profile page (lazy)
      HowToPlayScroll.tsx      — rules page + SVG illustrations (lazy)
      LeaderboardScroll.tsx    — ELO rankings (lazy)
      AvatarDevSandbox.tsx     — ?dev=avatar sandbox (lazy, dev only)
      AuthModal.tsx            — sign in / sign up / username prompt modal (lazy)
      AvatarDisplay.tsx        — renders composed avatar SVG from AvatarConfig
      AvatarMaker.tsx          — avatar editor UI (layer-by-layer selector)
      LobbyPanel.tsx           — game lobby UI (lazy)
      ThemeSwitcher.tsx        — theme switcher component
      DefeatFire.tsx           — fire effect on defeat (own Canvas; frame loop pauses when tab hidden)

  lib/
    avatarConfig.ts            — AvatarConfig type, counts, SVG imports, layer arrays
    themes.ts                  — ThemeConfig definitions
    textures.ts                — texture-gen helpers (dev only)
    supabase.ts                — Supabase client singleton

  assets/
    avatars/
      hair/0.svg … N.svg       — hair shapes (Illustrator-editable; no fill attr → inherits hairColor)
      eyes/0.svg, 1.svg
      mouth/0.svg, 1.svg
      helmet/0.svg, 1.svg
      facial-hair/0.svg, 1.svg — 0.svg is empty; 1+ have shapes that inherit hairColor

  contexts/
    intro.ts                   — IntroStartContext (carries introStartMs for light timing)

supabase/
  migrations/
    001_profiles.sql           — profiles table, RLS
    002_online_matches.sql     — games, game_results tables, RLS, Realtime
    003_elo_improvements.sql   — ELO trigger, side_bias table, improved K-factor
    004_challenges_table.sql   — challenges table, RLS (two delete policies), games insert policy, Realtime
    005_avatar_column.sql      — ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar jsonb
                                 (must be run manually in Supabase dashboard — not yet applied)
```

---

## Architecture

### State (gameStore.ts)

Single Zustand store. Key fields:

| Field | Type | Purpose |
|---|---|---|
| `pieces` | `Piece[]` | All active pieces including dying ones mid-animation |
| `dyingPieces` | `Piece[]` | Captured pieces still playing their death animation |
| `selectedId` | `string \| null` | Currently selected piece |
| `validMoves` | `[number,number][]` | Valid destinations for selected piece |
| `currentTurn` | `'attacker' \| 'defender'` | Whose turn it is |
| `playerMode` | `'attacker' \| 'defender' \| '2player'` | Human role |
| `rules` | `Rules` | Active ruleset name |
| `boardSize` | `number` | Active board size (7/9/11/13/15/19) |
| `winner` | `null \| 'attacker' \| 'defender'` | Set when game ends |
| `captorIds` | `string[]` | Piece IDs that triggered captures last move (for celebration animation) |
| `captureDelayMs` | `number` | Delay before dying pieces are cleared (scales with move distance) |
| `undoTrigger` | `number` | Increments on undo; pieces watch it to trigger shake |
| `lastMoveTarget` | `{row,col} \| null` | Target of last move (used for lightning bolt) |
| `lastMove` | `{pieceId,toRow,toCol} \| null` | Set in `movePiece`; watched by App.tsx to broadcast online moves |
| `powerSaving` | `boolean` | Switches to SVG rendering |
| `difficulty` | `'easy' \| 'medium' \| 'hard'` | AI difficulty |
| `userId` | `string \| null` | Supabase user ID if logged in |
| `username` | `string \| null` | Display name if set |
| `elo` | `number \| null` | Current ELO rating |
| `authReady` | `boolean` | True once session restore attempt has completed |

Key actions:
- `selectPiece(id)` — validates turn + player ownership, computes valid moves
- `movePiece(row, col)` — executes move for selected piece; filters dying pieces from activePieces before calling `applyMove`; sets `lastMove`
- `machineMove(pieceId, row, col)` — same as movePiece but for the AI (and for incoming online opponent moves)
- `clearDyingPieces()` — removes dying pieces from `pieces` after animation completes
- `undoMove()` — restores last history entry
- `resetGame()` — fresh board from current `rules` + `boardSize`
- `setAuth(userId, username, elo?)` — sets all auth fields at once
- `setElo(elo)` — updates ELO after a game
- `setSetting(key, value)` — updates any of: `musicEnabled`, `cameraLocked`, `difficulty`, `rules`, `powerSaving`, `boardSize`, `playerMode`

### Game Logic (hnefatafl.ts)

Pure functions, no side effects.

**`getBoardConfig(rules, boardSize?)`** — central config lookup. `CONFIGS` is `Record<string, Partial<Record<number, BoardConfig>>>`. Rules that support multiple board sizes (Copenhagen, Fetlar, Historical) have entries for each size with distinct starting layouts. Looks up `CONFIGS[rules][boardSize]` for an exact match; falls back to the first available size for that ruleset, with a boardSize/center override if needed.

**`BoardConfig`** fields:
- `boardSize`, `center` — grid dimensions and throne position
- `attackerStarts`, `defenderStarts` — `[row,col][]` starting positions
- `kingEscapeEdge?` — if true, king escapes to any edge square (not just corners)
- `shieldwall?` — enables shieldwall captures (Copenhagen/Tawlbwrdd)
- `weakKing?` — king can be sandwiched like a normal piece once off throne
- `noThrone?` — throne has no special properties (Tyr variants)
- `attackerFirst?` — if true, attackers move first (Tyr, Simple Tyr). `resetGame` and `resetPiecesOnly` read this to set `currentTurn`.

**`getValidMoves(piece, pieces, boardSize, center, noThrone?)`** — returns `[row,col][]` of legal squares.

**`applyMove(pieces, id, row, col, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)`** — moves piece, checks captures, checks win. Returns `{ pieces, capturedIds, winner }`.

**Capture rules:**
- **Custodial** — piece sandwiched between two enemies (or one enemy + hostile square) after a move. Hostile squares: corners, empty throne (if noThrone is false).
- **Shieldwall** — 2+ enemy pieces against an edge, both ends flanked by a corner or friendly piece. King immune.
- **King capture** — strong king needs all 4 sides sealed. Weak king sandwiched like a normal piece once off the throne.
- **Passive capture** — `checkKingCaptured` is only called when `moverIsAttacker` is true. The king moving himself into a surrounded position does not trigger a loss (Ard Rí fix).

### AI (ai.ts / aiWorker.ts / aiClient.ts)

Iterative-deepening minimax with alpha-beta pruning and a transposition table — full documentation lives in the README's "AI — Architecture & Contribution Guide" section.

The search runs in a **Web Worker** (`aiWorker.ts`). Callers use `requestBestMove(params)` from `aiClient.ts`, which returns a promise. Because the search is async, every caller **re-checks game state on resolve** (turn, winner, gameKey) before applying the move — the game may have been reset or undone while the worker ran.

Difficulty:
- **Easy** — 1-ply heuristic; grabs obvious captures, otherwise random
- **Medium** — depth 2–3 (by board size) + noise
- **Hard** — depth 2–5 (by board size), 800ms budget

**Important:** always filter `dyingPieces` out of `pieces` before calling `requestBestMove` — dying pieces are still in the store's `pieces` array during their animation.

---

## Menu / Settings

The menu is a single settings panel. `MenuOverlay` renders directly with no sub-screens.

**Settings rows:**
1. **Play** — `Online` | `Vs Machine` | `Take turns`
2. **Side** — fades to opacity 0.25 when Play = `Take turns`. Active for both `Online` and `Vs Machine`.
3. **Difficulty** — fades to opacity 0.25 when Play ≠ `Vs Machine`
4. **Board** — board size cycler
5. **Rules** — filtered to sizes valid for current board
6. **Power Saving** — toggle
7. **View** — fades to opacity 0.25 when Power Saving is on (forced to Top-down)
8. Inline button row: **Resume** | **New Game**

**Below the panel (outside it):**
- Cancel button

**Footer links (mobile only, hidden ≥768px):**
- How to Play · Games · Leaderboard · About — equally spaced across full width, inset 5vw each side

**Play mode mapping:**

| Draft play value | `playerMode` stored |
|---|---|
| `Vs Machine` | `draft.side` — whichever side the player chose |
| `Take turns` | `'2player'` |
| `Online` | set later when game starts (assigned side from lobby) |

---

## UI Button Layout

Two absolutely-positioned column divs (`.ui-col`) sit at `top: 5vw`, inset `5vw` from each side.

**Mobile (<768px):** columns stack vertically (`flex-direction: column`, `gap: 2vw`). Buttons display icon + label inline (`flex-direction: row`). Right-column buttons use `row-reverse` so the label is left of the icon.
- Left: Login, Hint
- Right: Setup, Undo

**Desktop (≥768px):** columns lay out horizontally (`flex-direction: row`, `gap: 2vw`). Buttons stack icon above label (`flex-direction: column`). Right column uses `row-reverse` so Setup ends up rightmost despite being first in the DOM.
- Left: Login, Games, Ranks, Hint
- Right: Undo, Credits, How To, Setup

Items visible only on desktop are wrapped in `.ui-col__desktop-only` (`display: none` → `display: contents` at breakpoint), which makes them join the parent flex container rather than adding a nesting level.

All icons are in `public/icons/` as SVGs with `width="20" height="20"` intrinsic size. CSS sizes them to 22px via `.ui-button__icon`.

Score panels (`.score-panel-wrapper`) sit at `bottom: 14vw` on mobile, `bottom: 5vw` on desktop, `left/right: 5vw`.

The logo, score panels, and all buttons share the same `vis = uiVisible && !menuOpen` gate and the same `0.4s ease` opacity transition. All three groups also fade to 0 during `setupAnimating`. Hint and Undo additionally hide (opacity 0, pointer-events none) in online/spectating mode and in 2-player (take turns) mode.

---

**Resume / New Game / Cancel:**
- **Resume** — disabled when draft rules, boardSize, or play mode differ from store (requires a new game)
- **New Game** — applies settings and calls `resetGame()` + `startSetupAnim()`. If Play is `Online`, opens the lobby instead. No role-select screen — side is always set from the Setup menu.
- **Cancel** — resets draft to current store values, closes menu.

---

## Online Match Flow

### Entry points
- Game menu → Play: Online → New Game
- Profile screen → Play Online button (opens lobby directly with current settings)

### Lobby (`useLobby.ts`)

`useLobby(userId, username, onGameStart)` returns: `{ challenges, myChallenge, activeGames, hostChallenge, cancelChallenge, acceptChallenge }`

`activeGames` — list of `ActiveGame` objects (id, attacker_name, defender_name, rules, board_size, started_at) for the "Live Games" lobby section. Populated via `loadActiveGames()` (fetches `games WHERE status='active'` joined to profiles) and kept live via Realtime on the games table.

- **`hostChallenge(rules, boardSize, side)`** — deletes any existing challenge from this user, inserts new `challenges` row; sets `myChallenge` locally
- **`cancelChallenge()`** — deletes own challenge row
- **`acceptChallenge(challenge)`** — atomically deletes the challenge row first (only one concurrent acceptor gets the row back); winner inserts a `games` row and calls `onGameStart`
- Realtime `postgres_changes` on `challenges` → `loadChallenges()` — keeps lobby list live for all users
- Realtime `postgres_changes INSERT` on `games` filtered to `attacker_id=eq.{userId}` and `defender_id=eq.{userId}` — notifies the host when a game starts

### Game start (`handleGameStart` in App.tsx)

1. Apply `rules` + `boardSize` to store
2. Set `playerMode` to assigned side
3. `resetGame()`
4. `startGame(gameId, mySide)` — joins the Realtime broadcast channel
5. Close lobby and menu
6. DB fetch: load both players' `username` and `elo` from the `games` row (joined to `profiles`) — this is the source of truth for names and ratings; broadcast values are merged without overwriting DB data

### OnlineStatus type

```ts
type OnlineStatus =
  | { type: 'idle' }
  | { type: 'matched'; gameId: string; opponentName: string; opponentElo: number | null; opponentId: string | null }
  | { type: 'opponent_disconnected'; secondsLeft: number }
  | { type: 'ended' }
  | { type: 'spectating'; gameId: string }
```

`handleOnlineStatusChange` in App.tsx merges `matched` updates — broadcast/presence values cannot overwrite DB-fetched `opponentName`, `opponentElo`, or `opponentId` once set.

### Playing

- Local `movePiece()` → App.tsx watches `lastMove` → `sendMove(pieceId, toRow, toCol)`
- Opponent broadcast → `machineMove(pieceId, toRow, toCol)`
- Seq validation: gap → `resync_request` → full `pieces` + seq reply

### Game end

`winner` set in store + `onlineStatus.type === 'matched'` → `endGame(winnerId)`:
- `winnerId` = `userId` if local player won, else `opponentId` from `OnlineStatus`
- Updates `games` table: `status: 'completed'`, `winner_id`, `ended_at` via `.then()` (must be chained — supabase-js v2 queries only execute when `.then()` or `await` is called)
- ELO trigger fires automatically server-side
- Both clients unsubscribe from the channel

**Important:** Hint and Undo buttons are hidden during online matches.

### Spectating

From the lobby, any active game shows a Watch button. `handleWatch` in App.tsx:
1. Applies the game's `rules` and `boardSize` to the store
2. Calls `resetGame()`
3. Calls `watchGame(gameId)` — joins the game's broadcast channel as read-only
4. After subscribing, sends a `resync_request` broadcast
5. An active player responds with a `resync` event containing the full `pieces` array + seq
6. Spectator calls `setPieces()` to initialise board state, then applies subsequent `move` broadcasts via `machineMove`
7. Board pointer events are disabled while spectating
8. AI tick is suppressed while spectating
9. Spectator bar shown with a Leave button (`stopWatching()` + `resetGame()`)

### `useOnlineGame` hook

`useOnlineGame(onStatusChange)` returns: `{ startGame, watchGame, stopWatching, sendMove, endGame }`

Internal state held in `useRef<OnlineGameState>` (not React state):
```ts
{ gameId, mySide, seq, disconnectTimer, channel }
```

---

## ELO System

Calculated server-side via Postgres trigger `update_elo` on `games` AFTER UPDATE (when `status` changes to `'completed'`).

**K-factor:**
| Condition | K |
|---|---|
| Provisional (< 30 completed games) | 40 |
| Standard (< 2000 ELO) | 32 |
| Master (≥ 2000 ELO) | 16 |
| Repeat opponent in last 5 games | capped at 20 |

**Formula:** `E = 1 / (1 + 10^((opp_elo - my_elo) / 400))`, `R' = max(100, R + round(K * (S - E)))`

**Side bias:** `side_bias` table allows per-variant bias adjustments (attacker_bias column, default 0).

Migration: `supabase/migrations/003_elo_improvements.sql`

---

## Auth & Backend (Supabase)

Auth is opt-in — guest play works without an account.

**Session flow:**
1. On mount, `supabase.auth.getSession()` restores session → `setAuth(userId, username, elo)` + `setAuthReady(true)`
2. `supabase.auth.onAuthStateChange` keeps store in sync — fetches both `username` and `elo` on every auth event
3. Login/signup via `AuthModal.tsx`
4. Username set in `profiles` table via upsert after first login

**Tables:**

`profiles`:
```sql
id uuid, username text unique, elo int default 1000, created_at timestamptz
```

`game_results`:
```sql
id uuid, user_id uuid → profiles, opponent_type text, result text,
rules text, board_size int, created_at timestamptz
```

`games`:
```sql
id uuid, attacker_id uuid → profiles (on delete cascade),
defender_id uuid → profiles (on delete cascade),
rules text, board_size int, status text,
winner_id uuid → profiles (on delete set null),
started_at timestamptz, ended_at timestamptz
```

`challenges`:
```sql
id uuid, host_id uuid → profiles (on delete cascade),
host_name text, host_side text, rules text, board_size int, created_at timestamptz
```

`side_bias`:
```sql
rules text primary key, attacker_bias float default 0
```

Realtime enabled on `challenges` and `games`.

---

## Score Panels

Two score panels (`.score-panel-wrapper`) sit at `bottom: 14vw` on mobile / `bottom: 5vw` on desktop, `left/right: 5vw`. Width is content-sized (`fit-content`).

When logged in (any mode):
- Player's own name and ELO shown on their side's panel
- Name displayed above ELO in gold

Online games:
- Both players' names and ELOs shown (fetched from DB on game start)

---

## 3D Rendering

### Scene.tsx

Hosts the R3F Canvas and all lighting. Manages the `menuPhase` state machine.

**Lighting:**

| Light | Purpose |
|---|---|
| AmbientLight | Low-level fill (intensity 0.02) |
| DirectionalLight (moon) | Cool top-down fill |
| SpotLight | Main dramatic key light; follows King; beam width scales with board size |
| DirectionalLight (front) | Warm front fill |
| PointLight (bounce) | Warm bounce under the board |
| PointLight (back) | Rim from behind |

**menuPhase state machine:**
```
idle → hiding → hidden → (board flips open)
              ← appearing ← (board flips back) ← idle
```
Transitions use `setTimeout` keyed to `HIDE_MS = 410ms`.

### Board.tsx

The whole tile grid is **one merged `BufferGeometry`** (single mesh, single material, one draw call). At mount, the 11 tile textures are drawn into a canvas **texture atlas** (`tileAtlas`, 4×3 cells with a 10px bleed pad per cell); each square's texture variant and 90° rotation are baked into its UVs by `remapUVsToAtlasCell` when the merged geometry is built. Overlay markings (corner/throne/start squares) are a second merged plane layer against a 2×2 overlay atlas. The geometry rebuilds only when `boardSize`/rules change.

Pointer handling is a **single set of handlers on the merged mesh** — the square is derived from the intersection point:

```tsx
const local = boardMeshRef.current.worldToLocal(e.point.clone())
const col = Math.round(local.x + boardOffset)
const row = Math.round(local.z + boardOffset)
```

`handleBoardClick` then applies the old per-tile logic (valid target → `movePiece`; piece → `selectPiece`; empty → deselect). This also remains the piece-selection path for InstancedMesh pieces — R3F v9's `instanceId` on pointer events is unreliable.

`ValidMoveMarker` orbs are still individual animated meshes (only rendered for the selected piece's valid moves) with their own `onClick`/hover handlers that `stopPropagation` so they win over the board mesh.

### PiecesLayer.tsx

All attacker and defender pieces (not king) rendered as two `InstancedMesh` objects.

- `MAX_ATTACKERS = 72`, `MAX_DEFENDERS = 24` — sized for largest variants
- Unused slots set to zero-scale `Matrix4.makeScale(0,0,0)` each frame to prevent origin ghosts
- `depthWrite={false}` required — prevents semi-transparent instances from leaving dark silhouette ghosts over the board during fade animations
- Halo ring: a single `<mesh>` repositioned each frame to follow the selected non-king piece

### Piece.tsx (King only)

Individual `Mesh` — unique geometry, gold colour, celebration/hover behaviour.

---

## Animations

### Intro drop
Pieces fall from above. Board arrives first, then pieces stagger (king → defenders → attackers, 35ms apart).

### Piece movement
Cubic ease-in-out lerp with parabolic arc. Duration: `max(0.5, dist * 0.28)` seconds.

### Capture explosion (DustCloud)
36 particles: 18 debris shards, 10 flames, 8 smoke spheres. Imperatively driven in `useFrame`.

### Undo (lightning + shake)
Lightning bolt → white flash CSS overlay → board trembles → all pieces shake.

### Spotlight tracking
SpotLight target mesh lerps toward King's position each frame. `angle = 0.18 + boardSize * 0.025`.

---

## Variants

| Variant | Board | King | Escape | Shieldwall |
|---|---|---|---|---|
| Copenhagen | 11×11 or 13×13 | Strong | Corners | Yes |
| Fetlar | 11×11 or 13×13 | Strong | Corners | No |
| Historical | 11×11 or 13×13 | Weak | Corners | No |
| Tawlbwrdd | 11×11 | Strong | Edge | Yes |
| Simple Tyr | 11×11 | Strong | Corners | No |
| Linnaeus Tablut | 9×9 | Weak | Edge | No |
| Saami Tablut | 9×9 | Weak | Edge | No |
| Brandub | 7×7 | Weak | Corners | No |
| Ard Rí | 7×7 | Strong | Corners | No |
| Tyr | 15×15 | Strong | Corners | No |
| Alea Evangelii | 19×19 | Strong | Corners | No |

Copenhagen, Fetlar, and Historical each have two distinct starting layouts per board size. The 13×13 layout (Parlett reconstruction) has 32 attackers + 16 defenders.

`BOARD_SIZE_RULES` in `src/game/variants.ts` maps each board size to its valid rulesets; the same module exports `variantSlug`/`rulesFromSlug` for `?rules=` deep links.

---

## Avatar System

Players can customise an avatar shown on their profile.

### AvatarConfig
```ts
interface AvatarConfig {
  skinColor: number   // index into SKIN_COLORS
  hair: number        // index into HAIRS
  hairColor: number   // index into HAIR_COLORS
  eyes: number
  mouth: number
  helmet: number
  facialHair: number
}
```

### Layer composition

`AvatarDisplay` renders a square `<div>` with `background: SKIN_COLORS[skinColor]`, then an `<svg viewBox="0 0 100 100">` stacking layers in order:

1. **Hair** — `fill={hairColor}`, `dangerouslySetInnerHTML` with `HAIRS[hair]`
2. **Eyes**
3. **Mouth**
4. **Helmet**
5. **Facial Hair** — `fill={hairColor}`

Pass `circle` prop to clip the display to a circle (used in profile chip and score panels).

### SVG source files

`src/assets/avatars/<layer>/<index>.svg` — editable in Illustrator/Figma. Imported via Vite `?raw`. The `inner()` helper in `avatarConfig.ts` strips the `<svg>` wrapper to extract just the inner markup.

Hair and facial-hair SVGs must have **no `fill` attribute** on their paths — they inherit the `fill` from the parent `<g fill={hairColor}>`.

### Dev sandbox

`?dev=avatar` URL param (dev builds only) renders `AvatarDevSandbox` — a full-screen `AvatarMaker` for testing all layer combinations without logging in.

### Database

`profiles.avatar jsonb` column stores the serialised `AvatarConfig`. Migration `005_avatar_column.sql` adds this column — must be applied manually in the Supabase dashboard.

---

## Power-saving Mode

When active:
- R3F Canvas replaced with `Board2D.tsx` — pure SVG
- No shadows, particles, or lighting
- View option in menu disabled (forced to top-down)

Game state (Zustand) is shared — switching mid-game preserves all piece positions.

---

## Textures & Images

All textures in `public/textures/` are **hand-edited source files**, stored as **WebP**. **Never run `npm run gen-textures`** — it overwrites them.

- `piece-dark.webp` / `piece-dark-roughness.webp` — attacker
- `piece-light.webp` / `piece-light-roughness.webp` — defender
- `piece-king.webp` / `piece-king-roughness.webp` — king
- `tile-1.webp` … `tile-10.webp` — board tile variants
- `tile-11.webp` — corner / throne tile
- `tile-corner.webp`, `tile-throne.webp`, `tile-defender.webp`, `tile-attacker.webp` — overlay markers
- `board-edge.webp` — board base texture

All other `public/` images are WebP too (`node scripts/convert-webp.mjs` converts new additions in place; it skips `og-highkings.jpg` — link previews want jpg/png). MedievalSharp is self-hosted in `public/fonts/`.

Tile texture rotation: `mulberry32(seed)` PRNG assigns a stable variant + rotation (0–3) per square. Both are baked into the merged geometry's UVs against the tile atlas (see Board.tsx section) — there are no per-tile texture clones.

---

## Hint System

Two-stage:
1. First press — `requestBestMove` (async, worker) evaluates the human side's best move; on resolve it re-checks turn/winner, stores the move in `hintMove.current`, and calls `selectPiece`
2. Second press — executes the stored move

`hintMove.current` cleared on every turn change or game reset. Always filter `dyingPieces` before calling `requestBestMove`.

---

## Persistence

`gameStore` uses zustand's `persist` middleware (localStorage key `highkings`, version 1):
- **Settings always persist** — musicEnabled, cameraLocked, difficulty, rules, boardSize, powerSaving, playerMode, theme
- **In-progress games persist** — pieces, currentTurn, scores, and the last 20 history entries, but only while `winner === null`. Finished games boot fresh. History is capped so Alea Evangelii can't blow the localStorage quota.

Separate localStorage flag `highkings-onboarded` gates the first-visit "How to play" nudge.

URL params (checked once on mount, after rehydration): `?ps=true` forces power saving; `?rules=<slug>` (+ optional `&board=<n>`) deep-links a variant and resets the board — slug helpers live in `src/game/variants.ts`.

---

## Discoverability

- `index.html` — canonical URL, JSON-LD `VideoGame` schema, PWA manifest link
- `public/guide/index.html` — static crawlable rules/variants page with `?rules=` play links (nginx serves it at `/highkings/guide/`; Vite dev only serves it at the full `/guide/index.html` path)
- `public/sitemap.xml` — lists `/` and `/guide/` (submit in Google Search Console)
- `public/manifest.webmanifest` + `icon-192/512.png` — installable PWA (no service worker yet)

---

## Deploy

GitHub Actions on push to `main` (`.github/workflows/deploy.yml`). Builds with Vite, uploads `dist/` via FTP to Fasthosts.

Base URL: `/highkings/` (set in `vite.config.ts`).

`npm run build:compressed` additionally emits `.gz`/`.br` files — not used on Fasthosts (no `gzip_static`), kept for a possible future host.

Live: https://drewnotweird.co.uk/highkings

---

## Known Gotchas

- **Never run `npm run gen-textures`** — overwrites hand-edited textures.
- **No HDR environment map** — `environment preset="night"` was removed; caused the Supabase CDN to return 400 for the `.hdr` file, crashing the WebGL canvas.
- **InstancedMesh + transparent materials** — must use `depthWrite={false}`. Without it, semi-transparent instances block geometry behind them during fade animations.
- **Piece selection via tile click** — R3F v9 `instanceId` on pointer events is unreliable. All piece selection goes through `Board.tsx` tile `onClick`.
- **JSX materials only** — R3F's reconciler applies colour space transforms for JSX `<meshPhysicalMaterial>`. Creating materials with `new MeshPhysicalMaterial({...})` bypasses this and produces washed-out colours.
- **Always filter dyingPieces before AI/hint calls** — dying pieces remain in `pieces` during their animation.
- **TDZ shadowing** — never write `const { boardSize } = getBoardConfig(rules, boardSize)`. The `const` puts the new `boardSize` in TDZ, so the argument throws before the call executes. Omit `boardSize` from the destructure.
- **PostgREST aggregates not enabled** — don't use `count:id.count()` in Supabase JS client queries. Group client-side instead.
- **Online: DB fetch is source of truth for names/ELO** — broadcast/presence events can fire with empty values. `handleOnlineStatusChange` merges `matched` updates to prevent broadcasts from overwriting DB-fetched data.
- **endGame must pass real winner ID** — pass `userId` or `opponentId` (from `OnlineStatus`), never `null`. `null` is treated as a draw by the ELO trigger.
- **supabase-js queries require `.then()` or `await`** — fire-and-forget calls like `supabase.from(...).update(...)` without chaining do not execute. Always chain `.then()` (or `await`) or the HTTP request never goes out.
- **challenges table RLS** — two delete policies are needed: one for the host (cancel), one for any authenticated user (accept). A single `using (auth.uid() = host_id)` policy blocks acceptors. Migration: `004_challenges_table.sql`.
- **games table needs an insert policy** — the acceptor creates the `games` row, not just the host. Without `with check (auth.uid() = attacker_id or auth.uid() = defender_id)` on insert, the acceptor's insert is silently blocked by RLS.
- **vs-machine stat recorder fires in online games** — guard with `onlineStatus.type !== 'matched'` AND `difficulty !== 'easy'` to prevent spurious inserts during online games and to exclude easy mode from profile stats.
- **Online game results need a separate recorder** — the vs-machine effect doesn't fire for online games. A dedicated `useEffect` watching `winner + onlineStatus.type === 'matched'` inserts with `opponent_type: 'human'`.
- **Spectator resync** — spectator joins channel → sends `resync_request` → active player responds with full `pieces` + seq → spectator calls `setPieces()`. Without this the spectator sees an empty board.
- **`setPieces` in gameStore** — added to support spectator board initialisation. Sets `pieces`, clears `dyingPieces`, `selectedId`, `validMoves`.
- **AI runs in a Web Worker** — `requestBestMove` is async; every caller must re-check turn/winner/gameKey when the promise resolves before applying the move.
- **Selector-less `useGameStore()` is banned** — it re-renders on every store change (including animation ticks). Use `useGameSlice('a', 'b')` (shallow-compared) instead.
- **Texture atlas bleed** — atlas cells have a 10px pad; UVs are clamped to 0..1 before remapping so extrude side-wall UVs can't sample neighbouring cells. If tiles ever show seams at distance, increase `ATLAS_PAD`.
- **Persist partialize is conditional** — game-state keys are only written while `winner === null`; don't add transient fields (selectedId, dyingPieces, validMoves) to the persisted set.
- **Frame loops pause when the tab is hidden** — `frameloop={tabVisible ? 'always' : 'never'}` on both Canvases. Anything that must progress while hidden needs to be timer-based, not `useFrame`-based.
- **Avatar SVG layer composition** — SVG files in `src/assets/avatars/` are imported with Vite `?raw`. The `inner()` helper strips the outer `<svg>` wrapper so content can be injected via `dangerouslySetInnerHTML`. Hair and facial-hair layers must have no `fill` attribute — they inherit `fill={hairColor}` from the parent `<g>`.
- **Avatar `sceneFadeIn` animation conflict** — never put `animation: 'sceneFadeIn ... forwards'` on an element whose opacity also needs to be dynamically controlled. The `forwards` fill locks opacity at 1 and overrides inline style changes. Use transition-only for those elements.
- **Stale online games** — `loadActiveGames` in `useLobby.ts` marks `games` rows older than 4 hours with `status: 'active'` as `'abandoned'` via a fire-and-forget `.then()` update. This fires each time the lobby loads.
- **machineMovesetLastMove echo** — `machineMove` must NOT set `lastMove`. Only `movePiece` (human moves) sets `lastMove`, which App.tsx watches to broadcast. If `machineMove` sets it, incoming opponent moves echo back as outgoing moves.
- **Loading gate** — three conditions must all be true before the loader dismisses: (1) 1s minimum hold, (2) Three.js assets ready (board + piece geometries), (3) UI image assets loaded. Auth (`getSession`) has a 5-second timeout safety net but is not part of the gate — Supabase can be blocked without preventing the game from loading.
