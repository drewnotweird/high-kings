# High Kings

A 3D browser implementation of Hnefatafl — an ancient Viking strategy board game.

**Live:** https://drewnotweird.co.uk/highkings

## About the game

Hnefatafl is an asymmetric strategy game. The defender escorts the King to a corner escape square while the attacker tries to surround and capture him. Pieces capture by custodial enclosure (sandwiching an opponent between two of your own).

## Stack

- **Vite + React + TypeScript**
- **React Three Fiber** — 3D board, pieces, lighting, animations
- **Zustand** — game state
- **Tailwind CSS v4**

## Features

- Four rule variants: Copenhagen (11×11), Tawlbwrdd (11×11), Tablut (9×9), Brandub (7×7)
- AI opponent with easy / medium / hard difficulty
- Play as defender, attacker, or 2-player local
- Hint button — three-stage assist: first press selects the AI's suggested piece (deselecting any current selection if it differs); second press on the already-selected hint piece executes the move
- Smooth 3D piece movement with arc lift and custodial capture explosions
- Spotlight follows the King across the board
- Power-saving mode — switches to a lightweight 2D SVG board (no WebGL)
- Settings: difficulty, rules variant, camera lock, power saving

## Development

```bash
npm install
npm run dev
```

## Deploy

GitHub Actions → FTP to Fasthosts shared hosting on push to `main`.

## Critical

**Do not run `npm run gen-textures`** — all textures in `public/textures/` are hand-edited source files.
