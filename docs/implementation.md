# High Kings — Implementation Notes

Last updated: 2026-06-25

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
| Animations (UI) | Framer Motion | ^12 |
| Backend | Supabase | ^2 |
| Hosting | Fasthosts (FTP via GitHub Actions) | — |

---

## File Map

```
src/
  App.tsx                      — root; routes intro → game
  main.tsx                     — React root mount

  game/
    hnefatafl.ts               — all game logic (rules, moves, capture, AI eval)
    ai.ts                      — minimax AI with alpha-beta pruning

  store/
    gameStore.ts               — Zustand store; single source of truth for game state

  components/
    board/
      Scene.tsx                — R3F Canvas, lights, camera, menuPhase state machine
      Board.tsx                — 3D tile grid, valid-move orbs, tile click handling
      Board2D.tsx              — SVG power-saving fallback board
    pieces/
      Piece.tsx                — individual mesh for the King only
      PiecesLayer.tsx          — InstancedMesh for all attacker/defender pieces
    ui/
      ThemeSwitcher.tsx        — settings panel (theme, rules, difficulty, etc.)
      DefeatFire.tsx           — fire effect on the losing side's score card

  lib/
    themes.ts                  — theme configs (board colours, piece colours)
    textures.ts                — texture-gen helpers (dev only)
    supabase.ts                — Supabase client

  contexts/
    intro.ts                   — context carrying introStartMs for light timing

  pages/                       — page-level components
```

---

## Architecture

### State (gameStore.ts)

Single Zustand store holds all game state. Key slices:

- `pieces` — current live pieces (excludes dying pieces)
- `dyingPieces` — pieces mid-capture-animation (managed separately so they animate out)
- `selectedId` — currently selected piece id
- `currentTurn` — `'attacker' | 'defender'`
- `playerMode` — `'attacker' | 'defender' | '2player'`
- `rules` — active rule variant (determines board size, king strength, escape rule, shieldwall)
- `winner` — `null | 'attacker' | 'defender'`
- `captorIds` — piece ids that triggered captures in the last move (used for celebration animation)
- `undoTrigger` — integer that increments on undo; pieces watch it to trigger shake
- `powerSaving` — boolean; switches rendering mode
- `difficulty` — AI difficulty (`'easy' | 'medium' | 'hard'`)

`selectPiece(id | null)` is the single entry point for piece selection. It validates turn ownership, deselects on re-click, and handles move execution when a valid target tile is clicked.

`movePiece(row, col)` executes a move for the selected piece.

### Game Logic (hnefatafl.ts)

Pure functions, no side effects. Key exports:

- `getBoardConfig(rules)` — returns board size, piece layout, and rule flags for each variant
- `getValidMoves(pieces, id, rules)` — returns `[row, col][]` of legal destinations
- `applyMove(pieces, id, row, col, rules)` — returns `{ pieces, captured, captorIds }`
- `checkWin(pieces, rules)` — returns `'attacker' | 'defender' | null`
- `isKingCaptured(pieces, rules)` — checks if king is surrounded on all required sides
- Shieldwall logic lives inside `applyMove` — only activates for Copenhagen/Tawlbwrdd

Capture rules:
- **Custodial**: a piece is captured if sandwiched between two enemy pieces (or one enemy + an empty throne/corner) along a straight line after a move
- **Shieldwall** (Copenhagen/Tawlbwrdd only): a contiguous line of 2+ enemy pieces against the board edge is captured in one move if both flanks are closed; king immune
- **King capture**: strong king (most variants) needs all four sides sealed; weak king (Linnaeus, Saami, Brandub) can be sandwiched like any piece once off the throne

### AI (ai.ts)

Minimax with alpha-beta pruning. Depth scales with difficulty:
- Easy: depth 1
- Medium: depth 2
- Hard: depth 3

Evaluation function scores: piece count balance, king distance to nearest corner, king mobility, attacker proximity to king.

The AI runs synchronously. On larger boards (19×19 Alea Evangelii) hard mode can be slow — no web worker yet.

---

## 3D Rendering

### Scene.tsx

Hosts the R3F Canvas and all lighting. Manages the `menuPhase` state machine.

**Lighting:**

| Light | Purpose |
|---|---|
| AmbientLight | Low-level fill (intensity 0.02) |
| DirectionalLight (moon) | Cool top-down fill |
| SpotLight | Main dramatic key light from above; follows King position; beam width scales with board size |
| DirectionalLight (front) | Warm front fill |
| PointLight (bounce) | Warm bounce under the board |
| PointLight (back) | Rim from behind |

All lights animate in during the intro sequence via an eased `f(start, duration)` ramp keyed to `introStartMs`. `menuScale` ref lerps 0→1 on menu open to dim gameplay lights (not the ambient or moon).

**menuPhase state machine:**

```
idle → hiding → hidden → (board flips open)
              ← appearing ← (board flips back)
                          ← idle
```

Transitions use `setTimeout` keyed to `HIDE_MS = 410ms`. Components that need to hide during menu open watch `menuPhase` as a prop.

### Board.tsx

Renders the tile grid as individual `<mesh>` boxes. Each tile:
- Randomly assigns one of 4 texture rotations (0°, 90°, 180°, 270°) for visual variation — this rotates the UV texture, not the tile geometry
- Highlights as a valid move target (orange glow) when a piece is selected
- Shows a `ValidMoveMarker` orb on valid-move tiles; orbs suppress during menu hide
- Handles all piece selection via tile click (see Piece Selection below)

**Tile click** is the primary piece-selection path:
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
This is the correct approach for InstancedMesh — R3F's `instanceId` on pointer events is unreliable in v9.

### PiecesLayer.tsx

All attacker and defender pieces (not the king) are rendered as two `InstancedMesh` objects — one for attackers, one for defenders. This reduces the draw call count from ~48 separate meshes to 2.

**Slot management:**
- `attackerSlots` / `defenderSlots` — fixed-length arrays mapping instance index → piece id (or null)
- `animMap` — `Map<id, PieceAnim>` holding all per-piece animation state
- When a piece is added, it claims the first free slot. When removed, its slot is freed and zeroed.
- Unused slots are set to zero-scale (`Matrix4.makeScale(0,0,0)`) each frame to prevent identity-matrix ghosts at the origin.

**Menu fade:**
- `menuOpacity` ref lerps 1→0 when `menuPhase` is `'hiding'` or `'hidden'`
- When `menuPhase === 'hidden'`, opacity snaps to 0 immediately
- `visible = false` at `opacity < 0.01`
- Materials use `depthWrite={false}` — critical for correct transparent rendering. Without this, semi-transparent instances write to the depth buffer during the fade and block the board surface behind them, leaving a dark ghost silhouette. Individual `Mesh` objects are per-object depth-sorted so this was never a problem in the old system; InstancedMesh renders all instances in one draw call with no per-instance sorting, so depth-write must be disabled.

**Halo ring:**
A single `<mesh>` (not instanced) sits inside `PiecesLayer` and is repositioned each frame to follow whichever non-king piece is selected. It pulses opacity to create the selection glow.

### Piece.tsx (King only)

The King uses an individual `Mesh` because it has unique geometry (taller lathe profile), a distinct gold colour, and a separate celebration/hover behaviour. Same `menuPhase`-driven opacity fade as PiecesLayer.

---

## Animations

### Intro drop

Each piece has a `dropDelay` calculated from its position in the piece list. Pieces fall from above with a parabolic arc (`JUMP_PEAK = 1.4`) and settle with a small knock (`< 0.14s`).

The board arrives first (`BOARD_ARRIVE = 1.2s`), then pieces drop with a per-piece stagger (`PIECE_STAGGER = 0.035s`). `getIntroDurationMs(numPieces)` calculates when the full intro is complete.

### Piece movement

Smooth cubic ease-in-out lerp from current visual position to target, with a parabolic arc height proportional to move distance (`dist * 0.22`, max 0.55`). Duration: `max(0.5, dist * 0.28)` seconds.

### Hover lift

Hoverable pieces (belonging to the current player's side) lift by `HOVER_LIFT = 0.28` units on `pointerEnter`. The King and non-hoverable pieces ignore it.

### Capture explosion (DustCloud)

On capture, a `DustCloud` component spawns at the captured piece's position. 36 particles total:
- 18 debris shards (octahedra) — gold, spin outward
- 10 flame tetrahedra — red/orange, rise and fade fast
- 8 smoke spheres — dark, expand and fade slowly

Each particle is an individual `<mesh>` with opacity driven imperatively in `useFrame`.

### Undo (lightning + shake)

On undo:
1. A jagged lightning bolt (fractal midpoint displacement, R3F `Line`) strikes the last-moved square
2. Screen white flash fades in/out via a CSS `<div>` overlay
3. Board trembles (sinusoidal Y offset decaying over 0.6s)
4. All pieces shake (sinusoidal X/Z offset per-piece over 0.65s)

`undoTrigger` increments in the store; pieces and the Scene both watch it via `useEffect`.

### Celebrate (captor pieces)

After a capture, the pieces that triggered the capture perform a small jump-and-spin. `captorIds` is set in the store after `applyMove`. A piece only starts the celebration once it has arrived at its destination and `celebrateReadyTime` has passed (450ms minimum, to allow for move animation).

### Spotlight tracking

The SpotLight target is a `<mesh>` that lerps toward the King's current position each frame. Beam angle scales with board size: `angle = 0.18 + boardSize * 0.025` (radians).

### Orb hover

`ValidMoveMarker` orbs respond to hover: the hovered orb descends slightly and brightens; all other orbs dim and scale down slightly. Implemented with `onPointerEnter`/`onPointerLeave` on each orb mesh and state lifted into Board.

---

## Variants

| Variant | Board | King | Escape | Shieldwall |
|---|---|---|---|---|
| Copenhagen | 11×11 | Strong (4 sides) | Corners | Yes |
| Tawlbwrdd | 11×11 | Strong | Edge | Yes |
| Linnaeus Tablut | 9×9 | Weak (2 sides off throne) | Edge | No |
| Saami Tablut | 9×9 | Weak | Edge | No |
| Brandub | 7×7 | Weak | Corners | No |
| Ard Rí | 7×7 | Strong | Corners | No |
| Alea Evangelii | 19×19 | Strong | Corners | No |

Starting layouts are defined in `getBoardConfig(rules)` in `hnefatafl.ts`. Ard Rí and Brandub differ only in piece count and starting formation (Ard Rí has 8 defenders + 12 attackers; Brandub has 4 + 8).

---

## Power-saving Mode

Toggled in Settings. When active:
- R3F Canvas is replaced with `Board2D.tsx` — a pure SVG board
- All `useFrame` loops check `powerSaving` and skip animations
- Pieces snap to position immediately
- No shadows, no particles, no lighting

Game state (Zustand) is shared between both rendering modes — switching mid-game preserves all piece positions.

---

## Textures

All textures are in `public/textures/` and are **hand-edited source files**. Do not regenerate them with `npm run gen-textures` — the script overwrites the hand-edited versions.

Texture files:
- `piece-dark.png` / `piece-dark-roughness.png` — attacker colour + bump
- `piece-light.png` / `piece-light-roughness.png` — defender colour + bump
- `piece-king.png` / `piece-king-roughness.png` — king colour + bump
- `tile-*.png` — board tile textures (multiple variants, randomly assigned + randomly rotated per tile)
- `board-border.png` — Celtic knotwork border texture

Texture rotation (per tile): a random index (0–3) is picked once at board init. This index is passed as a `rotation` prop to the tile mesh and applied via `material.map.rotation` — rotating the UV map, not the tile geometry.

---

## Theme System

`themes.ts` exports a `themes` array. Each `ThemeConfig` has:
- `name` — display name
- `boardColor`, `tileAltColor` — tile tints
- `ambientColor` — scene ambient tint
- `fogColor` — scene background/fog

Active theme is stored in the Zustand store and passed as a prop into Scene and Board.

---

## Hint System

Two-stage assist:
1. First press: AI evaluates the best move and selects the suggested piece (calls `selectPiece`). If a different piece is already selected, it deselects it first.
2. Second press on the same (already-selected) hint piece: executes the suggested move.

If the player selects a different piece between presses, the hint resets.

---

## Deploy

GitHub Actions workflow on push to `main`. Two jobs: build + FTP upload to Fasthosts shared hosting. Base URL is `/highkings/` (configured in `vite.config.ts` as `base: '/highkings/'`).

Live: https://drewnotweird.co.uk/highkings

---

## Known Gotchas

- **Do not run `npm run gen-textures`** — it overwrites hand-edited textures.
- **InstancedMesh + transparent materials**: must use `depthWrite={false}`. See PiecesLayer above.
- **Piece selection via tile click, not InstancedMesh pointer events**: R3F v9 `instanceId` on pointer events is unreliable. All piece selection goes through `Board.tsx` tile `onClick`.
- **JSX materials vs imperative construction**: R3F's reconciler applies colour space transforms for JSX `<meshPhysicalMaterial>` props. Creating materials with `new MeshPhysicalMaterial({color: ...})` bypasses this and produces washed-out colours. Always use JSX for R3F materials.
- **Zustand + R3F**: `useFrame` reads store state via `useGameStore()` at the top of each component; the store subscription triggers re-renders, not frame re-runs. Refs are used for animation state that changes every frame to avoid triggering React re-renders.
- **Alea Evangelii AI**: 19×19 board with 96 pieces. Hard mode (depth 3) can be slow. No web worker yet.
