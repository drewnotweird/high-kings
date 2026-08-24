import type { Piece } from './hnefatafl'
import { isCorner, isThrone } from './hnefatafl'

// Tafl squares are named like chess: file letter from the left, rank number
// counting up from the bottom. Used for screen-reader announcements.
export function squareName(row: number, col: number, boardSize: number): string {
  return String.fromCharCode(97 + col) + (boardSize - row)
}

function pieceName(p: Piece): string {
  return p.type === 'king' ? 'King' : p.type === 'defender' ? 'defender' : 'attacker'
}

// "d7, your defender, corner escape square" — what a screen reader reads out
// as the cursor lands on a square.
export function describeSquare(
  row: number, col: number, pieces: Piece[],
  boardSize: number, center: number,
  opts: { isValidTarget?: boolean; kingEscapeEdge?: boolean } = {}
): string {
  const parts = [squareName(row, col, boardSize)]
  const piece = pieces.find(p => p.row === row && p.col === col)
  parts.push(piece ? pieceName(piece) : 'empty')

  const escape = opts.kingEscapeEdge
    ? (row === 0 || col === 0 || row === boardSize - 1 || col === boardSize - 1)
    : isCorner(row, col, boardSize)
  if (escape) parts.push('escape square')
  else if (isThrone(row, col, center)) parts.push('throne')

  if (opts.isValidTarget) parts.push('can move here')
  return parts.join(', ')
}

// "Defender d4 to d7, capturing an attacker" — read out after a move lands.
export function describeMove(
  from: { row: number; col: number }, to: { row: number; col: number },
  mover: Piece, captured: Piece[], boardSize: number
): string {
  const base = `${pieceName(mover)} ${squareName(from.row, from.col, boardSize)} to ${squareName(to.row, to.col, boardSize)}`
  if (!captured.length) return base
  const what = captured.length === 1
    ? `capturing a ${pieceName(captured[0])}`
    : `capturing ${captured.length} pieces`
  return `${base}, ${what}`
}
