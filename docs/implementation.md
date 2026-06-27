# High Kings — Implementation Notes

Last updated: 2026-06-27

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
| CSS | Tailwind v4 | ^4 |
| Backend / Auth / DB | Supabase | ^2 |
| Hosting | Fasthosts (FTP via GitHub Actions) | — |

---

## File Map

```
src/
  App.tsx                      — root component; all overlay UI lives here
  main.tsx                     — React root mount

  game/
    hnefatafl.ts               — all game logic (rules, moves, captures, config)
    ai.ts                      — minimax AI with alpha-beta pruning

  store/
    gameStore.ts               — Zustand store; single source of truth

  hooks/
    useOnlineGame.ts           — online match hook (find/cancel/send/receive)

  components/
    board/
      Scene.tsx                — R3F Canvas, lights, camera, menuPhase state machine
      Board.tsx                — 3D tile grid, valid-move orbs, tile click handling
      Board2D.tsx              — SVG power-saving fallback board
    pieces/
      Piece.tsx                — individual mesh for the King only
      PiecesLayer.tsx          — InstancedMesh for all attacker/defender pieces
    ui/
      AuthModal.tsx            — sign in / sign up / username prompt modal
      FindMatchModal.tsx       — online match search modal
      ThemeSwitcher.tsx        — theme switcher component
      DefeatFire.tsx           — fire effect on the losing side's score card

  lib/
    themes.ts                  — ThemeConfig definitions
    textures.ts                — texture-gen helpers (dev only)
    supabase.ts                — Supabase client singleton

  contexts/
    intro.ts                   — IntroStartContext (carries introStartMs for light timing)
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
| `authReady` | `boolean` | True once session restore attempt has completed |

Key actions:
- `selectPiece(id)` — validates turn + player ownership, computes valid moves
- `movePiece(row, col)` — executes move for selected piece; filters dying pieces from activePieces before calling `applyMove`; sets `lastMove`
- `machineMove(pieceId, row, col)` — same as movePiece but for the AI (and for incoming online opponent moves)
- `clearDyingPieces()` — removes dying pieces from `pieces` after animation completes
- `undoMove()` — restores last history entry
- `resetGame()` — fresh board from current `rules` + `boardSize`
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

**`getValidMoves(piece, pieces, boardSize, center, noThrone?)`** — returns `[row,col][]` of legal squares. Pieces cannot pass through other pieces, land on the throne (unless it is the king), or land on corners (unless the king).

**`applyMove(pieces, id, row, col, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)`** — moves piece, checks custodial captures, checks shieldwall captures, checks win conditions. Returns `{ pieces, capturedIds, winner }`.

**Capture rules:**
- **Custodial** — piece sandwiched between two enemies (or one enemy + hostile square) after a move. Hostile squares: corners, empty throne (if noThrone is false).
- **Shieldwall** — 2+ enemy pieces against an edge, both ends flanked by a corner or friendly piece. King immune.
- **King capture** — strong king needs all 4 sides sealed. Weak king (Historical, Linnaeus Tablut, Saami Tablut, Brandub) sandwiched like a normal piece once off the throne.

### AI (ai.ts)

Single-ply scoring (not minimax). Each candidate move is scored by:
- Custodian capture opportunities (+12 per potential capture)
- King escape: +10000 if this move IS the escape; otherwise reward/penalise escape proximity
- Attacker: block king escape routes (-60 per open route after move), move toward king (+10 per step closer), bonus for adjacency (+18), intercept corner paths (+80)
- Defender: non-king pieces stay near king (+3 per step closer)

Difficulty:
- **Easy** — grabs obvious captures if available, otherwise random
- **Medium** — full evaluation + high noise (±20) → makes real strategic mistakes
- **Hard** — near-optimal with tiny noise (±1.5) to avoid determinism

The AI runs synchronously on the main thread. On 19×19 Alea Evangelii with 96 pieces, hard mode is noticeably slow. No web worker yet.

**Important:** always filter `dyingPieces` out of `pieces` before calling `getBestMove` — dying pieces are still in the store's `pieces` array during their animation and will confuse the AI.

---

## Menu / Settings

### Single-screen design

The menu is a single settings panel — there is no two-screen main/settings flow. `MenuOverlay` renders one screen directly; there is no `menuScreen` state.

**Settings panel rows (top to bottom):**
1. **Play** — cycler: `Online` | `Vs Machine` | `Take turns`
2. **Difficulty** — fades to opacity 0.25 and is non-interactive when Play ≠ `Vs Machine`
3. **Board** — board size cycler
4. **Rules** — rules cycler (options filtered to those valid for current board size)
5. **Power Saving** — toggle
6. **View** — camera lock toggle
7. Inline button row: **Resume** | **Start**

**Below the panel (outside it):**
- How To | Credits row
- Cancel button

### Play mode mapping

| Draft play value | `playerMode` stored |
|---|---|
| `Vs Machine` | `'defender'` (human plays defender) |
| `Take turns` | `'2player'` |
| `Online` | set later by `useOnlineGame.handleMatched` |

### Resume / Start / Cancel

- **Resume** — disabled (opacity 0.25) when `draft.rules`, `draft.boardSize`, or `draft.play` differ from current store values (these require a new game)
- **Start** — applies settings and calls `resetGame()`. If Play is `Online`, triggers online flow instead (see below)
- **Cancel** — resets draft to current store values, calls `onResume()`. No settings are applied.

### Rules / board size constraint

`BOARD_SIZE_RULES` in `App.tsx` maps each board size to its valid rulesets. The Board cycler drives the size; the Rules cycler shows only rules valid for that size.

---

## Online Match Flow

### Entry

1. User sets Play to **Online** in the settings panel and taps **Start**.
2. `onOnlineMatch(rules, boardSize)` fires — stores search settings in `searchSettings` state, shows `FindMatchModal`, calls `findMatch(rules, boardSize)`.
3. The search starts immediately. If not logged in, `AuthModal` opens first; `findMatch` is called after auth.

### FindMatchModal

- Receives `searchRules` / `searchBoardSize` as props (synced via `useEffect`).
- While `status.type === 'idle'`: shows Board + Rules cyclers and a **Find Opponent** button.
- While `status.type === 'searching'`: shows spinner + settings summary + **Cancel** button. Close button is hidden.
- While `status.type === 'matched'`: shows "Match found!" + opponent name.
- While `status.type === 'opponent_disconnected'`: shows countdown.
- The modal props (`searchRules`, `searchBoardSize`) are NOT applied to the store until a match is confirmed.

### On match confirmed

`useOnlineGame.handleMatched(gameId, side)`:
1. Clears poll interval
2. `setSetting('rules', matchRules)` + `setSetting('boardSize', matchBoardSize)`
3. `setPlayerMode(side)`
4. `resetGame()`
5. `joinGameChannel(gameId, side)`
6. `onStatusChange({ type: 'matched', ... })`

In App.tsx: `onStatusChange('matched')` → closes `FindMatchModal`, closes menu.

### Cancel

- Clears poll interval (`state.current.pollInterval = null`)
- Calls matchmaking Edge Function with `{ action: 'cancel' }` to remove lobby row
- `setShowFindMatch(false)` + `setOnlineStatus({ type: 'idle' })` → menu stays open, user back in settings

### Move broadcast

After each local `movePiece()`, App.tsx watches `lastMove` and calls `sendMove(pieceId, toRow, toCol)` when online.

### Receiving opponent moves

Broadcast `move` events → `machineMove(pieceId, toRow, toCol)` — reuses the same store action as AI moves.

Seq validation: if received `seq !== expected`, sends `resync_request`. Opponent replies with full `pieces` + seq.

### Disconnect

Realtime presence `leave` event → 30-second countdown → `opponent_disconnected` status with `secondsLeft`. On reconnect (`join` event), game resumes. After timeout, the waiting player wins by abandonment and the `games` row is updated.

### Match header

Shown when `onlineStatus.type === 'matched'`. Displays both players' names with the active side highlighted and a "Your turn / Their turn" indicator.

---

## useOnlineGame hook

`useOnlineGame(onStatusChange)` returns: `{ findMatch, cancelSearch, sendMove, endGame }`

- **`findMatch(matchRules, matchBoardSize)`** — calls matchmaking Edge Function; if `waiting`, starts 3s poll interval with 5-minute auto-cancel; does NOT touch the store until match is confirmed
- **`cancelSearch()`** — clears poll interval, calls cancel endpoint, fires `onStatusChange({ type: 'idle' })`
- **`sendMove(pieceId, toRow, toCol)`** — broadcasts on Realtime channel with incrementing seq
- **`endGame(winnerId)`** — updates `games` table, cleans up channel, fires `onStatusChange({ type: 'ended' })`

Internal state is held in a `useRef<OnlineGameState>` (not React state) to avoid re-render loops:
```ts
{ gameId, mySide, seq, pollInterval, disconnectTimer, channel }
```

Poll guard: `handleMatched` checks `state.current.pollInterval` before applying the match result — prevents a stale poll from firing after the user has cancelled.

---

## 3D Rendering

### Scene.tsx

Hosts the R3F Canvas and all lighting. Manages the `menuPhase` state machine. The `environment preset="night"` (drei) is **not used** — it was removed because the HDR map caused WebGL canvas crashes.

**Lighting:**

| Light | Purpose |
|---|---|
| AmbientLight | Low-level fill (intensity 0.02) |
| DirectionalLight (moon) | Cool top-down fill |
| SpotLight | Main dramatic key light; follows King; beam width scales with board size |
| DirectionalLight (front) | Warm front fill |
| PointLight (bounce) | Warm bounce under the board |
| PointLight (back) | Rim from behind |

All lights animate in during the intro via an eased ramp keyed to `introStartMs`. `menuScale` ref lerps 0→1 on menu open to dim gameplay lights.

**menuPhase state machine:**
```
idle → hiding → hidden → (board flips open)
              ← appearing ← (board flips back) ← idle
```
Transitions use `setTimeout` keyed to `HIDE_MS = 410ms`.

### Board.tsx

Renders the tile grid as individual `<mesh>` elements. Each tile:
- Has a randomly assigned texture variant + one of four UV rotations (0°/90°/180°/270°) for visual variety — UV rotation, not geometry rotation
- Highlights orange when it's a valid move target
- Shows a `ValidMoveMarker` orb when a piece is selected
- Handles piece selection via tile click (primary selection path — see below)

**`leavingMarkers`** — when valid moves change (piece deselected or moved), the previous orbs animate out in reverse distance order, creating a retraction ripple effect.

**Tile click — primary piece selection path:**
```tsx
onClick = () => {
  if (validTarget) movePiece(row, col)
  else {
    const pieceHere = pieces.find(p => p.row === row && p.col === col && p.type !== 'king')
    if (pieceHere) selectPiece(pieceHere.id)
    else if (selectedId) selectPiece(null)
  }
}
```
This is the correct approach for InstancedMesh — R3F v9's `instanceId` on pointer events is unreliable.

### PiecesLayer.tsx

All attacker and defender pieces (not the king) are two `InstancedMesh` objects — one per side. Reduces ~48 draw calls to 2.

**Slot management:**
- `MAX_ATTACKERS = 72`, `MAX_DEFENDERS = 24` — sized for the largest variants
- `attackerSlots` / `defenderSlots` — fixed arrays mapping instance index → piece id (null = free)
- `animMap` — `Map<id, PieceAnim>` holding all per-piece animation state
- Unused slots set to zero-scale `Matrix4.makeScale(0,0,0)` each frame to prevent origin ghosts

**Menu fade:**
InstancedMesh opacity lerps to 0 on menu open. When `menuPhase === 'hidden'`, opacity snaps immediately to 0. `depthWrite={false}` is required — without it, semi-transparent instances write to the depth buffer and leave a dark silhouette ghost over the board (per-instance depth sorting doesn't exist for InstancedMesh).

**Halo ring:** a single `<mesh>` (not instanced) repositioned each frame to follow the selected non-king piece. Pulses opacity for selection glow.

### Piece.tsx (King only)

The King uses an individual `Mesh` — unique geometry (taller lathe profile), gold colour, celebration/hover behaviour. Same menuPhase opacity fade as PiecesLayer, but uses a lerp rather than a snap (individual meshes are depth-sorted correctly so the ghost problem doesn't apply).

---

## Animations

### Intro drop
Pieces fall from above with a parabolic arc. Board arrives first (`BOARD_ARRIVE = 1.2s`), then pieces stagger (`PIECE_STAGGER = 0.035s` per piece, ordered king → defenders → attackers). `getIntroDurationMs(numPieces)` returns the total intro duration.

### Piece movement
Cubic ease-in-out lerp with parabolic arc height proportional to distance (`min(dist * 0.22, 0.55)`). Duration: `max(0.5, dist * 0.28)` seconds. `captureDelayMs` for the capture animation is `max(500, moveDist * 280) + 80ms`.

### Capture explosion (DustCloud)
36 particles spawned at the captured piece's position: 18 debris shards (gold octahedra), 10 flames (red/orange tetrahedra), 8 smoke spheres. All driven imperatively in `useFrame`.

### Undo (lightning + shake)
1. Jagged lightning bolt (fractal midpoint displacement, R3F `Line`) strikes the last-moved square
2. White flash CSS overlay
3. Board trembles (sinusoidal Y decay over 0.6s)
4. All pieces shake (sinusoidal X/Z per-piece over 0.65s)

`undoTrigger` increments in the store; Scene and pieces both watch it via `useEffect`.

### Celebrate (captor pieces)
Capturing pieces do a small jump-and-spin after arriving at their destination. Fires once `visualPosition ≈ targetPosition` AND `Date.now() >= celebrateReadyTime` (450ms minimum).

### Spotlight tracking
SpotLight target mesh lerps toward the King's position each frame. `angle = 0.18 + boardSize * 0.025` radians.

### Orb hover
Hovered valid-move orb descends and brightens; all others dim and shrink. `onPointerEnter`/`onPointerLeave` per orb, state lifted into Board.

---

## Variants

| Variant | Board | King | Escape | Shieldwall |
|---|---|---|---|---|
| Copenhagen | 11×11 or 13×13 | Strong (4 sides) | Corners | Yes |
| Fetlar | 11×11 or 13×13 | Strong | Corners | No |
| Historical | 11×11 or 13×13 | Weak (off-throne sandwich) | Corners | No |
| Tawlbwrdd | 11×11 | Strong | Edge | Yes |
| Simple Tyr | 11×11 | Strong | Corners | No |
| Linnaeus Tablut | 9×9 | Weak | Edge | No |
| Saami Tablut | 9×9 | Weak | Edge | No |
| Brandub | 7×7 | Weak | Corners | No |
| Ard Rí | 7×7 | Strong | Corners | No |
| Tyr | 15×15 | Strong | Corners | No |
| Alea Evangelii | 19×19 | Strong | Corners | No |

Copenhagen, Fetlar, and Historical each have **two distinct starting layouts** per board size. The 13×13 layout (Parlett reconstruction) has 32 attackers + 16 defenders in a diamond/cross pattern. Selecting a board size constrains which rules are shown; switching rules within a board size never forces a board size change.

In Settings: the Board cycler drives the size; the Rules cycler shows only rules valid for that size. `BOARD_SIZE_RULES` and `ALL_RULES` in App.tsx control this.

---

## Auth & Backend (Supabase)

Auth is opt-in — guest play works without an account.

**Session flow:**
1. On mount, `supabase.auth.getSession()` restores any existing session → `setAuth(userId, username)` + `setAuthReady(true)`
2. `supabase.auth.onAuthStateChange` keeps store in sync across tabs/sessions
3. Login/signup handled in `AuthModal.tsx` — screens: login, signup, email-confirm, username-setup, forgot-password
4. Username is set in the `profiles` table (`upsert`) after first login

**Tables:**

`profiles` — one row per user, created by Supabase trigger on `auth.users` insert:
```sql
id uuid, username text unique, avatar_url text, created_at timestamptz
```

`game_results` — one row per finished vs-machine game for a logged-in player:
```sql
id uuid, user_id uuid → profiles, opponent_type text, result text, rules text, board_size int, created_at timestamptz
```
RLS: users can only insert/select their own rows.

`games` — one row per online match:
```sql
id uuid, attacker_id uuid → profiles, defender_id uuid → profiles,
rules text, board_size int, status text ('active'|'completed'|'abandoned'),
winner_id uuid → profiles, started_at timestamptz, ended_at timestamptz
```

`moves` — one row per move in an online match:
```sql
id uuid, game_id uuid → games, player_id uuid → profiles,
piece_id text, from_row int, from_col int, to_row int, to_col int,
seq int, created_at timestamptz, unique(game_id, seq)
```

`lobby` — one row per player waiting for a match:
```sql
id uuid, player_id uuid → profiles unique, rules text, board_size int, queued_at timestamptz
```

Realtime enabled on `games` and `lobby` tables.

**Stats display (ProfileScroll in App.tsx):**
Loads on profile open. Fetches all `game_results` for `userId`, groups client-side by `(rules, board_size, opponent_type, result)`, displays W/L per variant per opponent type. Note: do not use PostgREST aggregate syntax (`count:id.count()`) — it is not enabled on this Supabase project.

**Stats recording:**
`useEffect([winner])` in `App` component inserts to `game_results` when a game ends. Only fires when `winner` is set, `userId` is non-null, and `playerMode !== '2player'`.

---

## Power-saving Mode

Toggled in Settings. When active:
- R3F Canvas replaced with `Board2D.tsx` — pure SVG
- All `useFrame` loops skip animations; pieces snap to position
- No shadows, particles, or lighting

Game state (Zustand) is shared — switching mid-game preserves all piece positions.

---

## Textures

All textures in `public/textures/` are **hand-edited source files**. **Never run `npm run gen-textures`** — it overwrites them.

- `piece-dark.png` / `piece-dark-roughness.png` — attacker
- `piece-light.png` / `piece-light-roughness.png` — defender
- `piece-king.png` / `piece-king-roughness.png` — king
- `tile-1.png` … `tile-10.png` — board tile variants (randomly assigned per tile)
- `tile-11.png` — corner / throne tile
- `tile-corner.png`, `tile-throne.png`, `tile-defender.png`, `tile-attacker.png` — overlay markers
- `board-edge.png` — board base texture

Tile texture rotation: `mulberry32(seed)` PRNG assigns each tile a stable random rotation index (0–3). Applied as `texture.rotation` with `texture.center.set(0.5, 0.5)` — UV rotation, not geometry.

---

## Hint System

Two-stage assist:
1. First press — AI evaluates best move for the human side (using alive pieces only), calls `selectPiece` to highlight the piece, and stores the full move in `hintMove.current`.
2. Second press — executes the stored move via `selectPiece` + sets `hintTarget` for the target highlight.

`hintMove.current` is cleared on every turn change or game reset. Always filter `dyingPieces` before calling `getBestMove` for hints — identical to what the machine move effect does.

---

## Deploy

GitHub Actions on push to `main`. Builds with Vite, uploads via FTP to Fasthosts shared hosting.

Base URL: `/highkings/` (set in `vite.config.ts` as `base: '/highkings/'`).

Live: https://drewnotweird.co.uk/highkings

Separate workflows per section exist for targeted deploys.

---

## Known Gotchas

- **Never run `npm run gen-textures`** — overwrites hand-edited textures.
- **No HDR environment map** — `environment preset="night"` was removed. It caused the Supabase CDN to return 400 for the `.hdr` file, crashing the WebGL canvas. Do not re-add it.
- **InstancedMesh + transparent materials** — must use `depthWrite={false}`. Without it, semi-transparent instances block geometry behind them during fade animations.
- **Piece selection via tile click** — R3F v9 `instanceId` on pointer events is unreliable. All piece selection goes through `Board.tsx` tile `onClick`, not the piece mesh directly.
- **JSX materials only** — R3F's reconciler applies colour space transforms for JSX `<meshPhysicalMaterial>`. Creating materials with `new MeshPhysicalMaterial({...})` bypasses this and produces washed-out colours.
- **Always filter dyingPieces before AI/hint calls** — dying pieces remain in `pieces` during their animation. Passing them to `getBestMove` or `getValidMoves` causes wrong results.
- **TDZ shadowing** — never write `const { boardSize } = getBoardConfig(rules, boardSize)`. The `const` puts the new `boardSize` in TDZ for the whole block, so the argument `boardSize` throws before the call executes. Omit `boardSize` from the destructure; use the store value directly.
- **PostgREST aggregates not enabled** — don't use `count:id.count()` in Supabase JS client queries. Group client-side instead.
- **Online: don't apply settings prematurely** — `findMatch` takes `matchRules`/`matchBoardSize` as params and does NOT touch the store. Settings are only applied inside `handleMatched` once a game is confirmed. This ensures Cancel returns the user to their original game state.
- **Alea Evangelii AI** — 19×19 with 96 pieces, hard mode is slow. No web worker yet.
