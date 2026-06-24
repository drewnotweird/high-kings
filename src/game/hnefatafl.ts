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
  kingEscapeEdge?: boolean  // Tawlbwrdd: king wins by reaching any edge square, not just corners
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

// Tawlbwrdd — 11x11 Welsh variant. King escapes to any edge square (not just corners).
const TAWLBWRDD: BoardConfig = { ...COPENHAGEN, kingEscapeEdge: true }

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

// --- Gameplay logic ---

const DIRS = [[-1,0],[1,0],[0,-1],[0,1]] as const

function isFriendly(a: Piece, b: Piece): boolean {
  return (a.type === 'attacker') === (b.type === 'attacker')
}

// A square that acts as a phantom captor for custodian captures
function isHostile(row: number, col: number, boardSize: number, center: number, pieces: Piece[]): boolean {
  if (isCorner(row, col, boardSize)) return true
  if (isThrone(row, col, center)) return !pieces.some(p => p.row === row && p.col === col)
  return false
}


export function getValidMoves(
  piece: Piece,
  allPieces: Piece[],
  boardSize: number,
  center: number
): [number, number][] {
  const occupied = new Set(allPieces.map(p => `${p.row},${p.col}`))
  const moves: [number, number][] = []

  for (const [dr, dc] of DIRS) {
    for (let step = 1; step < boardSize; step++) {
      const r = piece.row + dr * step
      const c = piece.col + dc * step

      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) break
      if (occupied.has(`${r},${c}`)) break

      // Corners and throne block non-king movement entirely; king can land on them
      if (isCorner(r, c, boardSize) || isThrone(r, c, center)) {
        if (piece.type === 'king') moves.push([r, c])
        break
      }

      moves.push([r, c])
    }
  }

  return moves
}

function checkKingCaptured(king: Piece, pieces: Piece[], boardSize: number, center: number): boolean {
  let surrounded = 0
  for (const [dr, dc] of DIRS) {
    const r = king.row + dr
    const c = king.col + dc
    if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) continue
    const neighbor = pieces.find(p => p.row === r && p.col === c)
    if (neighbor?.type === 'attacker' || isHostile(r, c, boardSize, center, pieces)) {
      surrounded++
    }
  }
  return surrounded === 4
}

export interface MoveResult {
  pieces: Piece[]
  capturedIds: string[]
  winner: 'attacker' | 'defender' | null
}

export function applyMove(
  pieces: Piece[],
  pieceId: string,
  toRow: number,
  toCol: number,
  boardSize: number,
  center: number,
  kingEscapeEdge = false
): MoveResult {
  // Move piece
  const moved = pieces.map(p => p.id === pieceId ? { ...p, row: toRow, col: toCol } : p)
  const mover = moved.find(p => p.id === pieceId)!

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
    if ((beyond && isFriendly(mover, beyond)) || isHostile(br, bc, boardSize, center, moved)) {
      capturedIds.push(neighbor.id)
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

  if (checkKingCaptured(king, remaining, boardSize, center)) {
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
