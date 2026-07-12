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
  kingEscapeEdge?: boolean  // king wins by reaching any edge square (not just corners)
  shieldwall?: boolean      // Copenhagen/Tawlbwrdd: contiguous edge line captured when both ends flanked
  weakKing?: boolean        // king off the throne can be sandwiched like a normal piece
  noThrone?: boolean        // center square has no special properties (Tyr)
  attackerFirst?: boolean   // attackers move first (Tyr variants)
}

const COPENHAGEN: BoardConfig = {
  boardSize: 11,
  center: 5,
  shieldwall: true,
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

// Fetlar — 11×11. Same starting positions as Copenhagen but corner escape only, no shieldwall.
const FETLAR: BoardConfig = { ...COPENHAGEN, shieldwall: false }

// Tawlbwrdd — 11x11 Welsh variant. King escapes to any edge square (not just corners).
const TAWLBWRDD: BoardConfig = { ...COPENHAGEN, kingEscapeEdge: true }

// Linnaeus Tablut — 9×9 as documented by Carl Linnaeus in 1732. Weak king, edge escape.
const LINNAEUS_TABLUT: BoardConfig = {
  boardSize: 9,
  center: 4,
  kingEscapeEdge: true,
  weakKing: true,
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

// Saami Tablut — 9×9 living Saami tradition. Defenders start in a wider diamond.
// Weak king, edge escape.
const SAAMI_TABLUT: BoardConfig = {
  boardSize: 9,
  center: 4,
  kingEscapeEdge: true,
  weakKing: true,
  attackerStarts: [
    [0,3],[0,4],[0,5],[1,4],
    [3,0],[4,0],[5,0],[4,1],
    [3,8],[4,8],[5,8],[4,7],
    [8,3],[8,4],[8,5],[7,4],
  ],
  defenderStarts: [
    [2,4],[4,2],[4,6],[6,4],
    [3,3],[3,5],[5,3],[5,5],
  ],
}

// Brandub — 7×7 Irish variant. Weak king, corner escape.
const BRANDUB: BoardConfig = {
  boardSize: 7,
  center: 3,
  weakKing: true,
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

// Ard Rí — 7×7 Irish "High King" variant. More pieces than Brandub: 8 defenders
// in an extended cross, 12 attackers along the edges. Strong king (4-sided capture
// always required), corner escape.
const ARD_RI: BoardConfig = {
  boardSize: 7,
  center: 3,
  attackerStarts: [
    [0,2],[0,3],[0,4],
    [2,0],[3,0],[4,0],
    [2,6],[3,6],[4,6],
    [6,2],[6,3],[6,4],
  ],
  defenderStarts: [
    [1,3],[2,3],[3,1],[3,2],[3,4],[3,5],[4,3],[5,3],
  ],
}

// Alea Evangelii — 19×19 "Game of the Gospels". Described in an 11th-century
// Anglo-Saxon manuscript (Christ Church, Canterbury, c.1110). Largest known
// Hnefatafl variant: 72 attackers in cruciform groups near each edge, 24
// defenders in an extended cross around the king. Strong king, corner escape.
// Piece positions follow the commonly cited reconstruction by Damian Walker.
const ALEA_EVANGELII: BoardConfig = {
  boardSize: 19,
  center: 9,
  attackerStarts: [
    // Top group (18)
    [0,3],[0,5],[0,7],[0,9],[0,11],[0,13],[0,15],
    [1,4],[1,6],[1,9],[1,12],[1,14],
    [2,5],[2,7],[2,9],[2,11],[2,13],
    [3,9],
    // Bottom group (18)
    [18,3],[18,5],[18,7],[18,9],[18,11],[18,13],[18,15],
    [17,4],[17,6],[17,9],[17,12],[17,14],
    [16,5],[16,7],[16,9],[16,11],[16,13],
    [15,9],
    // Left group (18)
    [3,0],[5,0],[7,0],[9,0],[11,0],[13,0],[15,0],
    [4,1],[6,1],[9,1],[12,1],[14,1],
    [5,2],[7,2],[9,2],[11,2],[13,2],
    [9,3],
    // Right group (18)
    [3,18],[5,18],[7,18],[9,18],[11,18],[13,18],[15,18],
    [4,17],[6,17],[9,17],[12,17],[14,17],
    [5,16],[7,16],[9,16],[11,16],[13,16],
    [9,15],
  ],
  defenderStarts: [
    [6,9],
    [7,8],[7,9],[7,10],
    [8,7],[8,8],[8,9],[8,10],[8,11],
    [9,6],[9,7],[9,8],[9,10],[9,11],[9,12],
    [10,7],[10,8],[10,9],[10,10],[10,11],
    [11,8],[11,9],[11,10],
    [12,9],
  ],
}

// Tyr — 15×15. Designed by Aage Nielsen. Weak king (2-sided capture), edge escape,
// no throne, attackers move first. 40 attackers, 20 defenders.
// Starting positions read from the official rules diagram (aagenielsen.dk/tyr_rules.pdf).
const TYR: BoardConfig = {
  boardSize: 15,
  center: 7,
  kingEscapeEdge: true,
  weakKing: true,
  noThrone: true,
  attackerFirst: true,
  attackerStarts: [
    // Row 0 (board row 15)
    [0,0],[0,3],[0,7],[0,11],[0,14],
    // Row 2 (board row 13)
    [2,2],[2,5],[2,9],[2,12],
    // Row 3 (board row 12)
    [3,0],[3,3],[3,6],[3,8],[3,11],[3,14],
    // Row 5 (board row 10)
    [5,2],[5,12],
    // Row 6 (board row 9)
    [6,3],[6,11],
    // Row 7 (board row 8) — edges
    [7,0],[7,14],
    // Row 8 (board row 7)
    [8,3],[8,11],
    // Row 9 (board row 6)
    [9,2],[9,12],
    // Row 11 (board row 4)
    [11,0],[11,3],[11,6],[11,8],[11,11],[11,14],
    // Row 12 (board row 3)
    [12,2],[12,5],[12,9],[12,12],
    // Row 14 (board row 1)
    [14,0],[14,3],[14,7],[14,11],[14,14],
  ],
  defenderStarts: [
    [4,4],[4,7],[4,10],
    [5,6],[5,8],
    [6,5],[6,7],[6,9],
    [7,4],[7,6],[7,8],[7,10],
    [8,5],[8,7],[8,9],
    [9,6],[9,8],
    [10,4],[10,7],[10,10],
  ],
}

// Simple Tyr — 11×11. Same rules as Tyr (weak king, edge escape, no throne, attackers first)
// but without Commanders. 24 attackers, 12 defenders.
// Starting positions read from the official rules diagram (aagenielsen.dk/tyr_rules.pdf).
const SIMPLE_TYR: BoardConfig = {
  boardSize: 11,
  center: 5,
  kingEscapeEdge: true,
  weakKing: true,
  noThrone: true,
  attackerFirst: true,
  attackerStarts: [
    [0,0],[0,3],[0,7],[0,10],
    [2,2],[2,5],[2,8],
    [3,0],[3,3],[3,7],[3,10],
    [5,2],[5,8],
    [7,0],[7,3],[7,7],[7,10],
    [8,2],[8,5],[8,8],
    [10,0],[10,3],[10,7],[10,10],
  ],
  defenderStarts: [
    [3,5],
    [4,4],[4,5],[4,6],
    [5,3],[5,4],[5,6],[5,7],
    [6,4],[6,5],[6,6],
    [7,5],
  ],
}

// Shared 13×13 starting positions (Parlett reconstruction, also used by Copenhagen/Fetlar 13×13).
// 32 attackers in a symmetric cross-and-edge pattern; 16 defenders + king in a diamond cluster.
const STARTS_13: Pick<BoardConfig, 'attackerStarts' | 'defenderStarts'> = {
  attackerStarts: [
    [0,4],[0,5],[0,6],[0,7],[0,8],
    [1,5],[1,7],
    [2,6],
    [4,0],[4,12],
    [5,0],[5,1],[5,11],[5,12],
    [6,0],[6,2],[6,10],[6,12],
    [7,0],[7,1],[7,11],[7,12],
    [8,0],[8,12],
    [10,6],
    [11,5],[11,7],
    [12,4],[12,5],[12,6],[12,7],[12,8],
  ],
  defenderStarts: [
    [3,6],
    [4,4],[4,8],
    [5,5],[5,6],[5,7],
    [6,3],[6,5],[6,7],[6,9],
    [7,5],[7,6],[7,7],
    [8,4],[8,8],
    [9,6],
  ],
}

// Copenhagen 13×13 — standard Copenhagen rules on a larger board.
const COPENHAGEN_13: BoardConfig = { boardSize: 13, center: 6, shieldwall: true, ...STARTS_13 }

// Fetlar 13×13 — Fetlar rules (strong king, corner escape, no shieldwall) on 13×13.
const FETLAR_13: BoardConfig = { ...COPENHAGEN_13, shieldwall: false }

// Historical 11×11 — same piece layout as Copenhagen 11×11, weak king, corner escape, no shieldwall.
const HISTORICAL_11: BoardConfig = { ...COPENHAGEN, weakKing: true, shieldwall: false }

// Historical 13×13 — Parlett 13×13 reconstruction, weak king, corner escape, no shieldwall.
const HISTORICAL_13: BoardConfig = { ...COPENHAGEN_13, weakKing: true, shieldwall: false }

const CONFIGS: Record<string, Partial<Record<number, BoardConfig>>> = {
  'Copenhagen':      { 11: COPENHAGEN,    13: COPENHAGEN_13 },
  'Fetlar':          { 11: FETLAR,         13: FETLAR_13 },
  'Historical':      { 11: HISTORICAL_11,  13: HISTORICAL_13 },
  'Tawlbwrdd':      { 11: TAWLBWRDD },
  'Linnaeus Tablut': { 9:  LINNAEUS_TABLUT },
  'Saami Tablut':   { 9:  SAAMI_TABLUT },
  'Brandub':        { 7:  BRANDUB },
  'Ard Rí':         { 7:  ARD_RI },
  'Alea Evangelii': { 19: ALEA_EVANGELII },
  'Tyr':            { 15: TYR },
  'Simple Tyr':     { 11: SIMPLE_TYR },
}

export function getBoardConfig(rules: string, boardSize?: number): BoardConfig {
  const sizeMap = CONFIGS[rules] ?? CONFIGS['Copenhagen']!
  if (boardSize !== undefined) {
    const exact = sizeMap[boardSize]
    if (exact) return exact
  }
  const fallback = Object.values(sizeMap)[0]!
  if (boardSize !== undefined && boardSize !== fallback.boardSize) {
    return { ...fallback, boardSize, center: Math.floor(boardSize / 2) }
  }
  return fallback
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

// --- Gameplay logic ---

const DIRS = [[-1,0],[1,0],[0,-1],[0,1]] as const

function isFriendly(a: Piece, b: Piece): boolean {
  return (a.type === 'attacker') === (b.type === 'attacker')
}

// A square that acts as a phantom captor for custodian captures
function isHostile(row: number, col: number, boardSize: number, center: number, pieces: Piece[], noThrone = false): boolean {
  if (isCorner(row, col, boardSize)) return true
  if (!noThrone && isThrone(row, col, center)) return !pieces.some(p => p.row === row && p.col === col)
  return false
}


export function getValidMoves(
  piece: Piece,
  allPieces: Piece[],
  boardSize: number,
  center: number,
  noThrone = false
): [number, number][] {
  const occupied = new Set(allPieces.map(p => `${p.row},${p.col}`))
  const moves: [number, number][] = []

  for (const [dr, dc] of DIRS) {
    for (let step = 1; step < boardSize; step++) {
      const r = piece.row + dr * step
      const c = piece.col + dc * step

      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) break
      if (occupied.has(`${r},${c}`)) break

      // Corners and (unless noThrone) throne block non-king movement; king can land on them
      if (isCorner(r, c, boardSize) || (!noThrone && isThrone(r, c, center))) {
        if (piece.type === 'king') moves.push([r, c])
        break
      }

      moves.push([r, c])
    }
  }

  return moves
}

function checkKingCaptured(king: Piece, pieces: Piece[], boardSize: number, center: number, weakKing: boolean, noThrone = false): boolean {
  // Weak king off the throne (or when there is no throne): sandwiched on any axis like a normal piece
  if (weakKing && (noThrone || !isThrone(king.row, king.col, center))) {
    for (const [dr, dc] of DIRS) {
      const r1 = king.row + dr, c1 = king.col + dc
      const r2 = king.row - dr, c2 = king.col - dc
      const h1 = pieces.find(p => p.row === r1 && p.col === c1)?.type === 'attacker'
             || isHostile(r1, c1, boardSize, center, pieces)
      const h2 = pieces.find(p => p.row === r2 && p.col === c2)?.type === 'attacker'
             || isHostile(r2, c2, boardSize, center, pieces)
      if (h1 && h2) return true
    }
    return false
  }
  // Strong king (or weak king on throne): needs all 4 sides hostile
  let surrounded = 0
  for (const [dr, dc] of DIRS) {
    const r = king.row + dr
    const c = king.col + dc
    // Board edges count as hostile — a king against the edge is surrounded on that side
    if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) { surrounded++; continue }
    const neighbor = pieces.find(p => p.row === r && p.col === c)
    if (neighbor?.type === 'attacker' || isHostile(r, c, boardSize, center, pieces)) surrounded++
  }
  return surrounded === 4
}

export interface MoveResult {
  pieces: Piece[]
  capturedIds: string[]
  winner: 'attacker' | 'defender' | null
}

// Shieldwall: a contiguous line of 2+ enemy pieces along an edge is captured when
// both ends are flanked by a corner or a piece of the moving side. The king cannot
// be captured this way — he must still be surrounded on all four sides.
function checkShieldwallCaptures(
  mover: Piece,
  pieces: Piece[],
  boardSize: number
): string[] {
  const last = boardSize - 1
  const moverIsAttacker = mover.type === 'attacker'
  const captured = new Set<string>()

  const edgeDefs = [
    { fixed: 'row' as const, fixedVal: 0,    along: 'col' as const },
    { fixed: 'row' as const, fixedVal: last,  along: 'col' as const },
    { fixed: 'col' as const, fixedVal: 0,    along: 'row' as const },
    { fixed: 'col' as const, fixedVal: last,  along: 'row' as const },
  ]

  for (const { fixed, fixedVal, along } of edgeDefs) {
    // Collect enemy non-king pieces on this edge, sorted along the edge
    const enemies = pieces
      .filter(p => {
        if (p.type === 'king') return false
        const isEnemy = moverIsAttacker ? p.type !== 'attacker' : p.type === 'attacker'
        return isEnemy && (fixed === 'row' ? p.row : p.col) === fixedVal
      })
      .sort((a, b) => (along === 'col' ? a.col - b.col : a.row - b.row))

    if (enemies.length < 2) continue

    // Walk contiguous runs of length ≥ 2
    let i = 0
    while (i < enemies.length) {
      let j = i + 1
      while (j < enemies.length) {
        const cur  = along === 'col' ? enemies[j].col   : enemies[j].row
        const prev = along === 'col' ? enemies[j-1].col : enemies[j-1].row
        if (cur - prev > 1) break
        j++
      }

      if (j - i >= 2) {
        const firstAlong = along === 'col' ? enemies[i].col     : enemies[i].row
        const lastAlong  = along === 'col' ? enemies[j-1].col   : enemies[j-1].row

        // A flanking square is hostile if it is a corner or occupied by the mover's side
        const isFlanked = (alongCoord: number) => {
          const r = fixed === 'row' ? fixedVal : alongCoord
          const c = fixed === 'col' ? fixedVal : alongCoord
          if (r < 0 || r > last || c < 0 || c > last) return false
          if (isCorner(r, c, boardSize)) return true
          const p = pieces.find(q => q.row === r && q.col === c)
          return !!p && (moverIsAttacker ? p.type === 'attacker' : p.type !== 'attacker')
        }

        if (isFlanked(firstAlong - 1) && isFlanked(lastAlong + 1)) {
          for (let k = i; k < j; k++) captured.add(enemies[k].id)
        }
      }
      i = j
    }
  }

  return [...captured]
}

export function applyMove(
  pieces: Piece[],
  pieceId: string,
  toRow: number,
  toCol: number,
  boardSize: number,
  center: number,
  kingEscapeEdge = false,
  shieldwall = false,
  weakKing = false,
  noThrone = false
): MoveResult {
  // Move piece
  const moved = pieces.map(p => p.id === pieceId ? { ...p, row: toRow, col: toCol } : p)
  const mover = moved.find(p => p.id === pieceId)!
  const moverIsAttacker = mover.type === 'attacker'

  // Custodian captures — skip the king (needs full surround, handled separately)
  const capturedIds: string[] = []
  for (const [dr, dc] of DIRS) {
    const nr = toRow + dr
    const nc = toCol + dc
    const neighbor = moved.find(p => p.row === nr && p.col === nc)
    if (!neighbor || isFriendly(mover, neighbor) || neighbor.type === 'king') continue

    const br = nr + dr
    const bc = nc + dc
    const beyond = moved.find(p => p.row === br && p.col === bc)
    if ((beyond && isFriendly(mover, beyond)) || isHostile(br, bc, boardSize, center, moved, noThrone)) {
      capturedIds.push(neighbor.id)
    }
  }

  // Shieldwall captures (Copenhagen / Tawlbwrdd)
  if (shieldwall) {
    for (const id of checkShieldwallCaptures(mover, moved, boardSize)) {
      if (!capturedIds.includes(id)) capturedIds.push(id)
    }
  }

  const remaining = moved.filter(p => !capturedIds.includes(p.id))

  // Win checks
  const king = remaining.find(p => p.type === 'king')
  if (!king) return { pieces: remaining, capturedIds, winner: 'attacker' }

  const kingEscaped = kingEscapeEdge
    ? (king.row === 0 || king.row === boardSize - 1 || king.col === 0 || king.col === boardSize - 1)
    : isCorner(king.row, king.col, boardSize)
  if (kingEscaped) {
    return { pieces: remaining, capturedIds, winner: 'defender' }
  }

  if (moverIsAttacker && checkKingCaptured(king, remaining, boardSize, center, weakKing, noThrone)) {
    return { pieces: remaining.filter(p => p.type !== 'king'), capturedIds: [...capturedIds, king.id], winner: 'attacker' }
  }

  // If all attackers are eliminated, the king cannot be captured — defenders win
  if (!remaining.some(p => p.type === 'attacker')) {
    return { pieces: remaining, capturedIds, winner: 'defender' }
  }

  return { pieces: remaining, capturedIds, winner: null }
}

// Whether a given square is a valid destination for the currently selected piece
export function isValidMove(row: number, col: number, validMoves: [number, number][]): boolean {
  return validMoves.some(([r, c]) => r === row && c === col)
}

// Returns true if the given side has at least one legal move available
export function hasMoves(side: 'attacker' | 'defender', pieces: Piece[], boardSize: number, center: number, noThrone?: boolean): boolean {
  for (const piece of pieces) {
    const isOnSide = side === 'attacker' ? piece.type === 'attacker' : (piece.type === 'defender' || piece.type === 'king')
    if (!isOnSide) continue
    if (getValidMoves(piece, pieces, boardSize, center, noThrone).length > 0) return true
  }
  return false
}
