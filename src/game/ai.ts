import { getValidMoves, isCorner, type Piece } from './hnefatafl'

export interface AiMove {
  pieceId: string
  toRow: number
  toCol: number
}

function getAllMoves(
  pieces: Piece[],
  side: 'attacker' | 'defender',
  boardSize: number,
  center: number,
  noThrone = false
): { piece: Piece; row: number; col: number }[] {
  const sidePieces = pieces.filter(p =>
    side === 'attacker' ? p.type === 'attacker' : p.type === 'defender' || p.type === 'king'
  )
  const result: { piece: Piece; row: number; col: number }[] = []
  for (const piece of sidePieces) {
    for (const [row, col] of getValidMoves(piece, pieces, boardSize, center, noThrone)) {
      result.push({ piece, row, col })
    }
  }
  return result
}

function distToNearestEscape(row: number, col: number, boardSize: number, kingEscapeEdge: boolean): number {
  if (kingEscapeEdge) {
    return Math.min(row, col, boardSize - 1 - row, boardSize - 1 - col)
  }
  const last = boardSize - 1
  return Math.min(
    Math.abs(row) + Math.abs(col),
    Math.abs(row) + Math.abs(col - last),
    Math.abs(row - last) + Math.abs(col),
    Math.abs(row - last) + Math.abs(col - last)
  )
}

function kingEscapeMoves(
  king: Piece,
  pieces: Piece[],
  boardSize: number,
  center: number,
  kingEscapeEdge: boolean,
  noThrone = false
): [number, number][] {
  const moves = getValidMoves(king, pieces, boardSize, center, noThrone)
  if (kingEscapeEdge) {
    return moves.filter(([r, c]) => r === 0 || r === boardSize - 1 || c === 0 || c === boardSize - 1)
  }
  return moves.filter(([r, c]) => isCorner(r, c, boardSize))
}

function scoreMove(
  pieces: Piece[],
  piece: Piece,
  toRow: number,
  toCol: number,
  side: 'attacker' | 'defender',
  boardSize: number,
  center: number,
  kingEscapeEdge: boolean,
  noThrone = false
): number {
  let score = 0
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const

  // Custodian capture heuristic
  for (const [dr, dc] of dirs) {
    const nr = toRow + dr, nc = toCol + dc
    if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) continue
    const neighbor = pieces.find(p => p.row === nr && p.col === nc)
    if (!neighbor) continue
    const isEnemy = side === 'attacker' ? neighbor.type !== 'attacker' : neighbor.type === 'attacker'
    if (!isEnemy || neighbor.type === 'king') continue
    const br = nr + dr, bc = nc + dc
    if (br < 0 || br >= boardSize || bc < 0 || bc >= boardSize) continue
    const beyond = pieces.find(p => p.row === br && p.col === bc)
    const beyondFriendly = beyond && (side === 'attacker' ? beyond.type === 'attacker' : beyond.type !== 'attacker')
    if (beyondFriendly || isCorner(br, bc, boardSize)) score += 12
  }

  const king = pieces.find(p => p.type === 'king')!
  const afterMove = pieces.map(p => p.id === piece.id ? { ...p, row: toRow, col: toCol } : p)

  if (piece.type === 'king') {
    const isEscape = kingEscapeEdge
      ? (toRow === 0 || toRow === boardSize - 1 || toCol === 0 || toCol === boardSize - 1)
      : isCorner(toRow, toCol, boardSize)
    if (isEscape) return 10000

    // Reward moving toward escape
    const prevDist = distToNearestEscape(piece.row, piece.col, boardSize, kingEscapeEdge)
    const newDist = distToNearestEscape(toRow, toCol, boardSize, kingEscapeEdge)
    score += (prevDist - newDist) * 12

    // Reward opening new escape routes
    const prevEscapes = kingEscapeMoves(king, pieces, boardSize, center, kingEscapeEdge, noThrone).length
    const newEscapes = kingEscapeMoves({ ...king, row: toRow, col: toCol }, afterMove, boardSize, center, kingEscapeEdge, noThrone).length
    score += (newEscapes - prevEscapes) * 35

  } else if (side === 'attacker') {
    const beforeEscapes = kingEscapeMoves(king, pieces, boardSize, center, kingEscapeEdge, noThrone)
    const afterEscapes = kingEscapeMoves(king, afterMove, boardSize, center, kingEscapeEdge, noThrone)

    // Heavily reward blocking an immediate king escape
    if (beforeEscapes.length > 0 && afterEscapes.length < beforeEscapes.length) {
      score += (beforeEscapes.length - afterEscapes.length) * 150
    }
    // Penalise open escape routes remaining after move
    score -= afterEscapes.length * 60

    // Move closer to king
    const prevDist = Math.abs(piece.row - king.row) + Math.abs(piece.col - king.col)
    const newDist = Math.abs(toRow - king.row) + Math.abs(toCol - king.col)
    score += (prevDist - newDist) * 10

    // Bonus for landing adjacent to king (threatening)
    if (newDist === 1) score += 18

    // Intercept clear file/rank escape paths to corners
    const last = boardSize - 1
    const corners: [number, number][] = [[0,0],[0,last],[last,0],[last,last]]
    for (const [cr, cc] of corners) {
      if (king.col === cc && king.row !== cr) {
        const minR = Math.min(king.row, cr), maxR = Math.max(king.row, cr)
        const pathClear = !pieces.some(p => p.col === cc && p.row > minR && p.row < maxR && p.id !== piece.id)
        if (pathClear && toCol === cc && toRow > minR && toRow < maxR) score += 80
      }
      if (king.row === cr && king.col !== cc) {
        const minC = Math.min(king.col, cc), maxC = Math.max(king.col, cc)
        const pathClear = !pieces.some(p => p.row === cr && p.col > minC && p.col < maxC && p.id !== piece.id)
        if (pathClear && toRow === cr && toCol > minC && toCol < maxC) score += 80
      }
    }

  } else {
    // Non-king defender: stay near king for protection
    const prevDist = Math.abs(piece.row - king.row) + Math.abs(piece.col - king.col)
    const newDist = Math.abs(toRow - king.row) + Math.abs(toCol - king.col)
    score += (prevDist - newDist) * 3
  }

  return score
}

export function getBestMove(
  pieces: Piece[],
  side: 'attacker' | 'defender',
  boardSize: number,
  center: number,
  difficulty: 'easy' | 'medium' | 'hard',
  kingEscapeEdge = false,
  _shieldwall = false,
  _weakKing = false,
  noThrone = false
): AiMove | null {
  const allMoves = getAllMoves(pieces, side, boardSize, center, noThrone)
  if (allMoves.length === 0) return null

  if (difficulty === 'easy') {
    // Easy: grab obvious captures if available, otherwise random
    const scored = allMoves.map(m => ({
      ...m,
      score: scoreMove(pieces, m.piece, m.row, m.col, side, boardSize, center, kingEscapeEdge, noThrone),
    }))
    const captures = scored.filter(m => m.score >= 12)
    const pool = captures.length > 0 ? captures : scored
    const pick = pool[Math.floor(Math.random() * pool.length)]
    return { pieceId: pick.piece.id, toRow: pick.row, toCol: pick.col }
  }

  // Medium: full evaluation but high noise → makes real strategic mistakes
  // Hard: near-optimal with tiny noise to avoid deterministic repetition
  const noise = difficulty === 'medium' ? 20 : 1.5
  const scored = allMoves
    .map(m => ({
      ...m,
      score: scoreMove(pieces, m.piece, m.row, m.col, side, boardSize, center, kingEscapeEdge, noThrone) + Math.random() * noise,
    }))
    .sort((a, b) => b.score - a.score)

  return { pieceId: scored[0].piece.id, toRow: scored[0].row, toCol: scored[0].col }
}
