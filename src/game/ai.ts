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
  center: number
): { piece: Piece; row: number; col: number }[] {
  const sidePieces = pieces.filter(p =>
    side === 'attacker' ? p.type === 'attacker' : p.type === 'defender' || p.type === 'king'
  )
  const result: { piece: Piece; row: number; col: number }[] = []
  for (const piece of sidePieces) {
    for (const [row, col] of getValidMoves(piece, pieces, boardSize, center)) {
      result.push({ piece, row, col })
    }
  }
  return result
}

function distToNearestCorner(row: number, col: number, boardSize: number): number {
  const last = boardSize - 1
  return Math.min(
    Math.abs(row) + Math.abs(col),
    Math.abs(row) + Math.abs(col - last),
    Math.abs(row - last) + Math.abs(col),
    Math.abs(row - last) + Math.abs(col - last)
  )
}

function scoreMove(
  pieces: Piece[],
  piece: Piece,
  toRow: number,
  toCol: number,
  side: 'attacker' | 'defender',
  boardSize: number
): number {
  let score = 0
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const

  // Custodian capture heuristic
  for (const [dr, dc] of dirs) {
    const nr = toRow + dr, nc = toCol + dc
    if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) continue
    const neighbor = pieces.find(p => p.row === nr && p.col === nc)
    if (!neighbor) continue
    const isEnemy = side === 'attacker'
      ? neighbor.type !== 'attacker'
      : neighbor.type === 'attacker'
    if (!isEnemy || neighbor.type === 'king') continue

    const br = nr + dr, bc = nc + dc
    if (br < 0 || br >= boardSize || bc < 0 || bc >= boardSize) continue
    const beyond = pieces.find(p => p.row === br && p.col === bc)
    const beyondFriendly = beyond && (side === 'attacker'
      ? beyond.type === 'attacker'
      : beyond.type !== 'attacker')
    if (beyondFriendly || isCorner(br, bc, boardSize)) score += 10
  }

  if (piece.type === 'king') {
    if (isCorner(toRow, toCol, boardSize)) return 10000
    const prevDist = distToNearestCorner(piece.row, piece.col, boardSize)
    const newDist = distToNearestCorner(toRow, toCol, boardSize)
    score += (prevDist - newDist) * 8
  } else if (side === 'attacker') {
    const king = pieces.find(p => p.type === 'king')
    if (king) {
      const prevDist = Math.abs(piece.row - king.row) + Math.abs(piece.col - king.col)
      const newDist = Math.abs(toRow - king.row) + Math.abs(toCol - king.col)
      score += (prevDist - newDist) * 2
    }
  }

  return score
}

export function getBestMove(
  pieces: Piece[],
  side: 'attacker' | 'defender',
  boardSize: number,
  center: number,
  difficulty: 'easy' | 'medium' | 'hard'
): AiMove | null {
  const allMoves = getAllMoves(pieces, side, boardSize, center)
  if (allMoves.length === 0) return null

  if (difficulty === 'easy') {
    const pick = allMoves[Math.floor(Math.random() * allMoves.length)]
    return { pieceId: pick.piece.id, toRow: pick.row, toCol: pick.col }
  }

  const noise = difficulty === 'medium' ? 7 : 1.5
  const scored = allMoves
    .map(m => ({
      ...m,
      score: scoreMove(pieces, m.piece, m.row, m.col, side, boardSize) + Math.random() * noise,
    }))
    .sort((a, b) => b.score - a.score)

  const pick = scored[0]
  return { pieceId: pick.piece.id, toRow: pick.row, toCol: pick.col }
}
