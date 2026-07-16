# High Kings

A 3D browser implementation of Hnefatafl — an ancient Viking strategy board game.

**Live:** https://drewnotweird.co.uk/highkings

## About the game

Hnefatafl is an asymmetric strategy game. The defender escorts the King to a corner escape square while the attacker tries to surround and capture him. Pieces capture by custodial enclosure (sandwiching an opponent between two of your own).

## Stack

- **Vite + React + TypeScript**
- **React Three Fiber** — 3D board, pieces, lighting, animations
- **Zustand** — game state, persisted to localStorage (settings + in-progress game survive refresh)
- **Supabase** — auth, database, realtime
- **Web Worker** — AI search runs off the main thread (no frame drops during the machine's turn)

## Features

### Gameplay
- 11 rule variants across board sizes 7×7 to 19×19 (see Variants below)
- Shieldwall captures (Copenhagen & Tawlbwrdd)
- AI opponent with easy / medium / hard difficulty
- Play as defender, attacker, or 2-player local
- Hint button — two-stage: first press selects the AI's suggested piece; second press executes the move (hidden in online matches and 2-player mode)
- Undo button — fades in after the first move; triggers lightning bolt, screen flash, board tremble, and piece shake in 3D mode (hidden in online matches and 2-player mode)
- Tile hover glow — valid move targets glow orange on hover
- Smooth 3D piece movement with arc lift and custodial capture explosions
- Spotlight follows the King; beam width scales with board size
- Power-saving mode — switches to a lightweight 2D SVG board (no WebGL)
- Settings and in-progress local games persist across refresh (localStorage)
- Variant deep links — `?rules=brandub`, `?rules=alea-evangelii&board=19`, etc. (slugs in `src/game/variants.ts`)
- First-visit nudge offers the Rules scroll to newcomers

### Online multiplayer
- Account-based (email/password) — guest play still works offline
- Game lobby — host a challenge with your chosen rules, board size, and side; other players can see and accept open challenges in real time
- ELO rating system — K=40 provisional (first 30 games), K=32 standard, K=16 master (2000+); grinding prevention caps K at 20 for repeat opponents
- Leaderboard — all registered players ranked by ELO
- Challenge invite notifications — logged-in players see incoming challenges while playing offline

### UI
- Profile screen — username, ELO rating, win/loss record by variant, Play Online shortcut, customisable avatar
- Avatar maker — choose skin colour, hair style and colour, eyes, mouth, helmet, and facial hair; composed from layered SVGs
- Score panels — show player name and ELO when logged in; expand to fit content
- Responsive button layout:
  - **Mobile (<768px):** top-left column (Login, Hint), top-right column (Setup, Undo), footer bar (How to Play · Games · Leaderboard · About)
  - **Desktop (≥768px):** top-left row (Login, Games, Ranks, Hint), top-right row (Credits, How To, Setup), footer hidden
- Setup button — opens settings panel; side choice available for Vs Machine and Online
- Spectate button in lobby — watch any live game in real time
- Easy mode wins excluded from profile stats

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

## Performance

- All public images are WebP (`node scripts/convert-webp.mjs` re-runs the conversion)
- Board tiles render as a single merged geometry with a runtime texture atlas — one draw call for the whole board top
- Pieces are two InstancedMeshes; the King is the only individual mesh
- Vendor code (three.js, React, Supabase) is split into separate long-cached chunks; overlay panels lazy-load
- Both WebGL canvases pause their frame loops when the tab is hidden
- SEO: static guide page at `/guide/`, JSON-LD, sitemap, PWA manifest

## Development

```bash
npm install
npm run dev
```

Other scripts:
- `npm run build` — type-check + production build
- `npm run build:compressed` — build plus precompressed `.gz`/`.br` files (only useful on hosts with `gzip_static`/`brotli_static`)
- `node scripts/convert-webp.mjs` — convert any new `public/` images to WebP in place

## Deploy

GitHub Actions → FTP to Fasthosts shared hosting on push to `main` (`.github/workflows/deploy.yml`).

## Critical

**Do not run `npm run gen-textures`** — all textures in `public/textures/` are hand-edited source files (now stored as `.webp`).

---

## AI — Architecture & Contribution Guide

### Files

| File | Role |
|---|---|
| `src/game/ai.ts` | Entire AI engine — search, evaluation, move ordering, repetition safety |
| `src/game/aiWorker.ts` | Web Worker host — runs `getBestMove` off the main thread |
| `src/game/aiClient.ts` | Promise wrapper (`requestBestMove`) used by App.tsx |
| `src/game/hnefatafl.ts` | Game rules — `getValidMoves`, `applyMove`, `positionKey`, `hasMoves` |
| `src/App.tsx` | Calls `requestBestMove` for the machine's turn and the Hint button |

### How the AI works

The AI uses **iterative deepening minimax with alpha-beta pruning**. It repeatedly searches at depth 1, 2, 3 … until either the maximum depth for the current board size is reached or the 800ms time budget expires — whichever comes first. Only results from fully completed depths are kept; if time runs out mid-depth the best move from the previous complete depth is returned.

The transposition table and move ordering both persist across iterations, so each depth benefits from what the shallower searches already learned. The best move from depth N (the principal variation move) is always searched first at depth N+1, which dramatically improves alpha-beta pruning.

**Maximum search depth by difficulty and board size:**

| Difficulty | 7×7 | 9×9 | 11–13×13 | 15–19×19 |
|---|---|---|---|---|
| Easy | 1 (no lookahead) | 1 | 1 | 1 |
| Medium | 3 | 2 | 2 | 2 |
| Hard | 5 | 4 | 3 | 2 |

Smaller boards have a much lower branching factor so deeper search is affordable within the budget. On a 7×7 Brandub game, hard mode routinely reaches depth 5 or beyond.

**`getBestMove` signature:**
```ts
getBestMove(
  pieces: Piece[],
  side: 'attacker' | 'defender',
  boardSize: number,
  center: number,
  difficulty: 'easy' | 'medium' | 'hard',
  kingEscapeEdge = false,   // true = Tawlbwrdd edge escape; false = corner escape
  shieldwall = false,        // true = Copenhagen / Tawlbwrdd shieldwall captures
  weakKing = false,          // true = king captured like any other piece
  noThrone = false,          // true = king may re-enter throne (some variants)
  positionHistory: string[]  // list of positionKey strings from game history
): AiMove | null
```

### Static position evaluator

All scores are from the **defender's perspective** (positive = good for defender, negative = good for attacker). The attacker minimises; the defender maximises.

| Term | Weight | Notes |
|---|---|---|
| Defender material | +40 per defender | Defenders are outnumbered so each counts more |
| Attacker material | −20 per attacker | |
| King distance to escape | −10 per step | Closer = better for defender |
| King open escape routes | +30 per route | Direct lines to corners / edges |
| Attacker proximity to king | −10 × (5 − dist) | For each attacker within 4 squares |
| Defender cohesion | +5 per adjacent pair | Adjacent defenders form walls and protect each other |
| Attacker encirclement | −8 × sides² | Quadratic penalty when 2+ orthogonal sides of the king have an unblocked attacker within 3 squares |
| King escape (terminal) | +9000 / −9000 | Win/loss detected inside the search tree |
| Stalemate (terminal) | ±9000 | Side to move loses if it has no legal moves |

The encirclement term uses quadratic scaling because the danger is non-linear: 2 sides covered is a mild threat, 3 sides is a near-trap, and 4 sides typically means capture is imminent.

### Move ordering

Moves are sorted before each depth to maximise alpha-beta pruning:
1. **PV move** — the best move from the previous ID iteration, always first
2. King moves to an escape square
3. King moves (any)
4. Attacker moves toward king (ranked by distance improvement)

The PV move ordering between iterations means the most promising line from depth N is expanded first at depth N+1, producing early cutoffs that can halve the effective tree size.

### Transposition table

A `Map<string, number>` keyed by `positionKey(pieces, side) + depth` caches evaluated positions across the entire `getBestMove` call — including across ID iterations. This means positions evaluated at depth 2 during the second iteration can be reused as lookup results during the depth-3 search, avoiding redundant work when different move sequences reach the same board state.

### Easy mode

Easy does not use minimax. It scores all moves with the 1-ply heuristic (custodian capture threats, king distance/escape heuristics), picks randomly from any capture opportunities, otherwise picks randomly across all moves.

**1-ply heuristic weights (attacker):**

| Heuristic | Weight |
|---|---|
| Custodian capture set-up | +12 |
| Block an immediate king escape | +150 × escapes blocked |
| Open escape routes remaining | −60 per route |
| Move closer to king | +10 per step |
| Land adjacent to king | +18 |
| Intercept clear corner path | +80 |

**1-ply heuristic weights (defender):**

| Heuristic | Weight |
|---|---|
| King moves toward escape | +12 per step |
| King opens new escape routes | +35 per new route |
| King reaches escape square | +10,000 |
| Non-king defender stays near king | +3 per step |
| Custodian capture set-up | +12 |

### Repetition safety

Before searching, the AI filters out any move that would create a 3rd repeated board position (a forfeit under the rules). A memoised `repCount` function calls `applyMove` once per candidate move and checks its resulting `positionKey` against the full game history. If all moves would repeat, the filter is lifted and the least-bad option is chosen.

### Integration points

The search runs in a **Web Worker** so the 800ms budget never blocks rendering. Callers go through the promise API and must re-check game state when the promise resolves (the position may have changed while the search ran):

```ts
// Machine's turn and the Hint button (src/App.tsx)
import { requestBestMove } from './game/aiClient'

requestBestMove({ pieces: alivePieces, side, boardSize, center, difficulty,
  kingEscapeEdge, shieldwall, weakKing, noThrone, positionHistory }).then(move => {
  const { currentTurn, winner, gameKey } = useGameStore.getState()
  if (winner || currentTurn !== side /* || game was reset */) return
  if (move) machineMove(move.pieceId, move.toRow, move.toCol)
})
```

Both call sites pass the full `positionHistory` so the repetition filter works correctly, and both filter `dyingPieces` out of `pieces` first.

