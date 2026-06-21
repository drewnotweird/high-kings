export const BOARD_SIZE = 11
export const CENTER = 5

export type PieceType = 'attacker' | 'defender' | 'king'

export interface Piece {
  id: string
  type: PieceType
  row: number
  col: number
}

const attackerStarts: [number, number][] = [
  [0,3],[0,4],[0,5],[0,6],[0,7],
  [1,5],
  [3,0],[4,0],[5,0],[6,0],[7,0],
  [5,1],
  [3,10],[4,10],[5,10],[6,10],[7,10],
  [5,9],
  [10,3],[10,4],[10,5],[10,6],[10,7],
  [9,5],
]

const defenderStarts: [number, number][] = [
  [3,5],[4,5],[5,3],[5,4],[5,6],[5,7],[6,5],[7,5],
  [4,4],[4,6],[6,4],[6,6],
]

export function createInitialPieces(): Piece[] {
  const pieces: Piece[] = []
  attackerStarts.forEach(([row, col], i) => {
    pieces.push({ id: `a${i}`, type: 'attacker', row, col })
  })
  defenderStarts.forEach(([row, col], i) => {
    pieces.push({ id: `d${i}`, type: 'defender', row, col })
  })
  pieces.push({ id: 'king', type: 'king', row: CENTER, col: CENTER })
  return pieces
}

export function isCorner(row: number, col: number): boolean {
  return (row === 0 || row === 10) && (col === 0 || col === 10)
}

export function isThrone(row: number, col: number): boolean {
  return row === CENTER && col === CENTER
}
