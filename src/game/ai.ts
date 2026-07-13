import { getValidMoves, isCorner, applyMove, positionKey, type Piece } from './hnefatafl'

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

// Easy mode: 1-ply heuristic scoring (move quality estimate, no lookahead)
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

    const prevDist = distToNearestEscape(piece.row, piece.col, boardSize, kingEscapeEdge)
    const newDist = distToNearestEscape(toRow, toCol, boardSize, kingEscapeEdge)
    score += (prevDist - newDist) * 12

    const prevEscapes = kingEscapeMoves(king, pieces, boardSize, center, kingEscapeEdge, noThrone).length
    const newEscapes = kingEscapeMoves({ ...king, row: toRow, col: toCol }, afterMove, boardSize, center, kingEscapeEdge, noThrone).length
    score += (newEscapes - prevEscapes) * 35

  } else if (side === 'attacker') {
    const beforeEscapes = kingEscapeMoves(king, pieces, boardSize, center, kingEscapeEdge, noThrone)
    const afterEscapes = kingEscapeMoves(king, afterMove, boardSize, center, kingEscapeEdge, noThrone)

    if (beforeEscapes.length > 0 && afterEscapes.length < beforeEscapes.length) {
      score += (beforeEscapes.length - afterEscapes.length) * 150
    }
    score -= afterEscapes.length * 60

    const prevDist = Math.abs(piece.row - king.row) + Math.abs(piece.col - king.col)
    const newDist = Math.abs(toRow - king.row) + Math.abs(toCol - king.col)
    score += (prevDist - newDist) * 10

    if (newDist === 1) score += 18

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
    const prevDist = Math.abs(piece.row - king.row) + Math.abs(piece.col - king.col)
    const newDist = Math.abs(toRow - king.row) + Math.abs(toCol - king.col)
    score += (prevDist - newDist) * 3
  }

  return score
}

// Static position evaluator for minimax leaf nodes.
// Returns a score from the defender's perspective: positive = good for defender.
function evalPosition(
  pieces: Piece[],
  boardSize: number,
  center: number,
  kingEscapeEdge: boolean,
  noThrone: boolean
): number {
  const king = pieces.find(p => p.type === 'king')
  if (!king) return -10000

  const attackers = pieces.filter(p => p.type === 'attacker')
  const defenders = pieces.filter(p => p.type === 'defender')

  let score = 0

  // Material — defenders are outnumbered so each is individually more valuable
  score += defenders.length * 40 - attackers.length * 20

  // King proximity to escape
  score -= distToNearestEscape(king.row, king.col, boardSize, kingEscapeEdge) * 10

  // King's open escape routes (direct lines to corners/edges)
  score += kingEscapeMoves(king, pieces, boardSize, center, kingEscapeEdge, noThrone).length * 30

  // Attacker threat: penalise attackers close to the king
  for (const a of attackers) {
    const dist = Math.abs(a.row - king.row) + Math.abs(a.col - king.col)
    if (dist <= 4) score -= (5 - dist) * 10
  }

  // Defender cohesion: adjacent defenders protect each other and form walls
  for (let i = 0; i < defenders.length; i++) {
    for (let j = i + 1; j < defenders.length; j++) {
      const dist = Math.abs(defenders[j].row - defenders[i].row) + Math.abs(defenders[j].col - defenders[i].col)
      if (dist === 1) score += 5
    }
  }

  return score
}

// Order moves to maximise alpha-beta pruning: winning/threatening moves first.
function orderMoves(
  moves: { piece: Piece; row: number; col: number }[],
  pieces: Piece[],
  side: 'attacker' | 'defender',
  boardSize: number,
  kingEscapeEdge: boolean
): { piece: Piece; row: number; col: number }[] {
  const king = pieces.find(p => p.type === 'king')
  return [...moves].sort((a, b) => {
    const priority = (m: { piece: Piece; row: number; col: number }) => {
      if (m.piece.type === 'king') {
        const escape = kingEscapeEdge
          ? (m.row === 0 || m.row === boardSize - 1 || m.col === 0 || m.col === boardSize - 1)
          : isCorner(m.row, m.col, boardSize)
        return escape ? 100 : 10
      }
      if (!king) return 0
      if (side === 'attacker') {
        // Prefer moving toward the king
        const prev = Math.abs(m.piece.row - king.row) + Math.abs(m.piece.col - king.col)
        const next = Math.abs(m.row - king.row) + Math.abs(m.col - king.col)
        return (prev - next) * 2
      }
      return 0
    }
    return priority(b) - priority(a)
  })
}

// Minimax with alpha-beta pruning and a transposition table.
// All scores are in defender-perspective units (positive = good for defender).
function minimaxSearch(
  pieces: Piece[],
  side: 'attacker' | 'defender',
  depth: number,
  alpha: number,
  beta: number,
  boardSize: number,
  center: number,
  kingEscapeEdge: boolean,
  shieldwall: boolean,
  weakKing: boolean,
  noThrone: boolean,
  tt: Map<string, number>
): number {
  const ttKey = positionKey(pieces, side) + depth
  const cached = tt.get(ttKey)
  if (cached !== undefined) return cached

  if (depth === 0) {
    const v = evalPosition(pieces, boardSize, center, kingEscapeEdge, noThrone)
    tt.set(ttKey, v)
    return v
  }

  const moves = orderMoves(
    getAllMoves(pieces, side, boardSize, center, noThrone),
    pieces, side, boardSize, kingEscapeEdge
  )

  if (moves.length === 0) {
    // Stalemate — the side to move loses
    const v = side === 'defender' ? -9000 : 9000
    tt.set(ttKey, v)
    return v
  }

  const opponent: 'attacker' | 'defender' = side === 'defender' ? 'attacker' : 'defender'
  const isMaximising = side === 'defender'
  let best = isMaximising ? -Infinity : Infinity

  for (const m of moves) {
    const result = applyMove(pieces, m.piece.id, m.row, m.col, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)

    let val: number
    if (result.winner === 'defender') {
      val = 9000 + depth // prefer faster wins
    } else if (result.winner === 'attacker') {
      val = -9000 - depth
    } else {
      val = minimaxSearch(result.pieces, opponent, depth - 1, alpha, beta, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone, tt)
    }

    if (isMaximising) {
      if (val > best) best = val
      if (val > alpha) alpha = val
    } else {
      if (val < best) best = val
      if (val < beta) beta = val
    }
    if (beta <= alpha) break
  }

  tt.set(ttKey, best)
  return best
}

export function getBestMove(
  pieces: Piece[],
  side: 'attacker' | 'defender',
  boardSize: number,
  center: number,
  difficulty: 'easy' | 'medium' | 'hard',
  kingEscapeEdge = false,
  shieldwall = false,
  weakKing = false,
  noThrone = false,
  positionHistory: string[] = []
): AiMove | null {
  const allMoves = getAllMoves(pieces, side, boardSize, center, noThrone)
  if (allMoves.length === 0) return null

  const nextTurn = side === 'attacker' ? 'defender' : 'attacker'

  // Compute repetition count per move, memoised to avoid calling applyMove twice
  const repCache = new Map<string, number>()
  function repCount(m: { piece: Piece; row: number; col: number }): number {
    const mk = `${m.piece.id}:${m.row}:${m.col}`
    if (repCache.has(mk)) return repCache.get(mk)!
    const result = applyMove(pieces, m.piece.id, m.row, m.col, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)
    const count = positionHistory.filter(k => k === positionKey(result.pieces, nextTurn)).length
    repCache.set(mk, count)
    return count
  }

  // Filter out moves that would create a 3rd repetition (AI forfeits if it makes one)
  const safeMoves = allMoves.filter(m => repCount(m) < 2)
  const pool = safeMoves.length > 0 ? safeMoves : allMoves

  // Easy: 1-ply heuristic, prefer captures, otherwise pick randomly
  if (difficulty === 'easy') {
    const scored = pool.map(m => ({
      ...m,
      score: scoreMove(pieces, m.piece, m.row, m.col, side, boardSize, center, kingEscapeEdge, noThrone),
    }))
    const captures = scored.filter(m => m.score >= 12)
    const candidates = captures.length > 0 ? captures : scored
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    return { pieceId: pick.piece.id, toRow: pick.row, toCol: pick.col }
  }

  // Medium / Hard: minimax with alpha-beta pruning
  // Depth scales down on large boards to stay within a comfortable time budget
  const baseDepth = difficulty === 'hard' ? 3 : 2
  const depth = boardSize >= 15 ? Math.max(1, baseDepth - 1) : baseDepth
  // Medium gets noise so it's beatable; hard plays near-optimally
  const noise = difficulty === 'medium' ? 15 : 0

  const isDefender = side === 'defender'
  const opponent: 'attacker' | 'defender' = isDefender ? 'attacker' : 'defender'
  const tt = new Map<string, number>()

  const orderedPool = orderMoves(pool, pieces, side, boardSize, kingEscapeEdge)

  const scored = orderedPool.map(m => {
    const result = applyMove(pieces, m.piece.id, m.row, m.col, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)

    let raw: number
    if (result.winner === 'defender') {
      raw = 9000
    } else if (result.winner === 'attacker') {
      raw = -9000
    } else {
      raw = minimaxSearch(result.pieces, opponent, depth - 1, -Infinity, Infinity, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone, tt)
    }

    // Scores are from the defender's perspective; flip sign if we're the attacker
    const val = isDefender ? raw : -raw

    return { ...m, score: val - repCount(m) * 40 + Math.random() * noise }
  }).sort((a, b) => b.score - a.score)

  return { pieceId: scored[0].piece.id, toRow: scored[0].row, toCol: scored[0].col }
}
