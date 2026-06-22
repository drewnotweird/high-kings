export type PieceType = 'attacker' | 'defender' | 'king'

export interface Piece {
  id: string
  type: PieceType
  row: number
  col: number
}

export interface BoardConfig {
  boardSize: number
  center: number
  attackerStarts: [number, number][]
  defenderStarts: [number, number][]
}

const COPENHAGEN: BoardConfig = {
  boardSize: 11,
  center: 5,
  attackerStarts: [
    [0,3],[0,4],[0,5],[0,6],[0,7],
    [1,5],
    [3,0],[4,0],[5,0],[6,0],[7,0],
    [5,1],
    [3,10],[4,10],[5,10],[6,10],[7,10],
    [5,9],
    [10,3],[10,4],[10,5],[10,6],[10,7],
    [9,5],
  ],
  defenderStarts: [
    [3,5],[4,5],[5,3],[5,4],[5,6],[5,7],[6,5],[7,5],
    [4,4],[4,6],[6,4],[6,6],
  ],
}

// Tawlbwrdd uses the same 11x11 layout as Copenhagen (rules differ, not board geometry)
const TAWLBWRDD: BoardConfig = { ...COPENHAGEN }

// Tablut — Linnaeus 9x9 historical layout
const TABLUT: BoardConfig = {
  boardSize: 9,
  center: 4,
  attackerStarts: [
    [0,3],[0,4],[0,5],[1,4],
    [3,0],[4,0],[5,0],[4,1],
    [3,8],[4,8],[5,8],[4,7],
    [8,3],[8,4],[8,5],[7,4],
  ],
  defenderStarts: [
    [2,4],[3,4],[4,2],[4,3],[4,5],[4,6],[5,4],[6,4],
  ],
}

// Brandub — 7x7 Irish variant
const BRANDUB: BoardConfig = {
  boardSize: 7,
  center: 3,
  attackerStarts: [
    [0,3],[1,3],
    [3,0],[3,1],
    [3,5],[3,6],
    [5,3],[6,3],
  ],
  defenderStarts: [
    [2,3],[3,2],[3,4],[4,3],
  ],
}

const CONFIGS: Record<string, BoardConfig> = {
  Copenhagen: COPENHAGEN,
  Tawlbwrdd: TAWLBWRDD,
  Tablut: TABLUT,
  Brandub: BRANDUB,
}

export function getBoardConfig(rules: string): BoardConfig {
  return CONFIGS[rules] ?? COPENHAGEN
}

export function isCorner(row: number, col: number, boardSize: number): boolean {
  const last = boardSize - 1
  return (row === 0 || row === last) && (col === 0 || col === last)
}

export function isThrone(row: number, col: number, center: number): boolean {
  return row === center && col === center
}

export function createInitialPieces(config: BoardConfig): Piece[] {
  const pieces: Piece[] = []
  config.attackerStarts.forEach(([row, col], i) => {
    pieces.push({ id: `a${i}`, type: 'attacker', row, col })
  })
  config.defenderStarts.forEach(([row, col], i) => {
    pieces.push({ id: `d${i}`, type: 'defender', row, col })
  })
  pieces.push({ id: 'king', type: 'king', row: config.center, col: config.center })
  return pieces
}
