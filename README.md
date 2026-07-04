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
- Hint button — two-stage: first press selects the AI's suggested piece; second press executes the move (hidden in online matches)
- Undo button — fades in after the first move; triggers lightning bolt, screen flash, board tremble, and piece shake in 3D mode (hidden in online matches)
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
- Profile screen — username, ELO rating, win/loss record by variant, Play Online shortcut
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
