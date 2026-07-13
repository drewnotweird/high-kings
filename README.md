# High Kings

A 3D browser implementation of Hnefatafl — an ancient Viking strategy board game.

**Live:** https://drewnotweird.co.uk/highkings

## About the game

Hnefatafl is an asymmetric strategy game. The defender escorts the King to a corner escape square while the attacker tries to surround and capture him. Pieces capture by custodial enclosure (sandwiching an opponent between two of your own).

## Stack

- **Vite + React + TypeScript**
- **React Three Fiber** — 3D board, pieces, lighting, animations
- **Zustand** — game state
- **Supabase** — auth, database, realtime

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

## Development

```bash
npm install
npm run dev
```

## Deploy

GitHub Actions → FTP to Fasthosts shared hosting on push to `main`.

## Critical

**Do not run `npm run gen-textures`** — all textures in `public/textures/` are hand-edited source files.

---

## AI — Architecture & Contribution Guide

### Files

| File | Role |
|---|---|
| `src/game/ai.ts` | Entire AI engine — search, evaluation, move ordering, repetition safety |
| `src/game/hnefatafl.ts` | Game rules — `getValidMoves`, `applyMove`, `positionKey`, `hasMoves` |
| `src/store/gameStore.ts` | Calls `getBestMove` in `machineMove` and the Hint button handler |

### How the AI works

The AI uses **minimax search with alpha-beta pruning** and a transposition table. It searches ahead 2 plies (medium) or 3 plies (hard), evaluates leaf nodes with a static position function, and returns the best move found. Easy mode stays 1-ply to keep it accessible.

**Search depth by difficulty and board size:**

| Difficulty | ≤ 13×13 boards | 15×15 and 19×19 |
|---|---|---|
| Easy | 1-ply (no lookahead) | 1-ply |
| Medium | Depth 2 + ±15 noise | Depth 1 + ±15 noise |
| Hard | Depth 3 | Depth 2 |

Large boards reduce depth by 1 to stay within a comfortable time budget (~500–800ms observed on an 11×11 hard game at move 1).

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
| King escape (terminal) | +9000 / −9000 | Win/loss detected inside the search tree |
| Stalemate (terminal) | ±9000 | Side to move loses if it has no legal moves |

### Move ordering

Before searching, moves are sorted to maximise alpha-beta pruning:
1. King moves to an escape square (instant high score, searched first)
2. King moves (any)
3. Attacker moves toward king (ranked by distance improvement)

This ordering means winning lines are typically found early and large branches can be pruned.

### Transposition table

A `Map<string, number>` keyed by `positionKey(pieces, side) + depth` caches evaluated positions within each `getBestMove` call. This avoids re-evaluating the same position at the same depth when the search tree has transpositions (different move orders reaching the same board state).

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

```ts
// Machine's turn — auto-fires after human move (src/store/gameStore.ts)
machineMove: (pieceId, toRow, toCol) => ...

// Hint button (src/App.tsx)
const posHistory = useGameStore.getState().history.map(h => h.posKey)
const hint = getBestMove(pieces, hintSide, boardSize, center, difficulty,
  kingEscapeEdge, shieldwall, weakKing, noThrone, posHistory)
```

Both pass the full `positionHistory` so the repetition filter works correctly.

### Ideas for further improvement

- **Opening book** — the first few moves are unconstrained; a small lookup table of known good openings would improve early play
- **Deeper search on smaller boards** — Brandub (7×7) could support depth 4–5 without a performance hit
- **Iterative deepening** — search depth 1, 2, 3 … and return the best move found when a time budget expires, rather than a fixed depth cutoff
- **Better attacker encirclement** — reward configurations where multiple attackers form a partial ring around the king
