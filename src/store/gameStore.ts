import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { createInitialPieces, getBoardConfig, getValidMoves, applyMove, hasMoves, positionKey } from '../game/hnefatafl'
import { describeMove } from '../game/notation'
import type { Piece, BoardConfig, WinReason } from '../game/hnefatafl'

// Extract posKeys from history for easy AI/repetition lookups
function historyKeys(history: { posKey: string }[]): string[] {
  return history.map(h => h.posKey)
}

function computeMovePath(fromRow: number, fromCol: number, toRow: number, toCol: number): [number, number][] {
  const path: [number, number][] = []
  if (fromRow === toRow) {
    const minC = Math.min(fromCol, toCol), maxC = Math.max(fromCol, toCol)
    for (let c = minC; c <= maxC; c++) path.push([fromRow, c])
  } else {
    const minR = Math.min(fromRow, toRow), maxR = Math.max(fromRow, toRow)
    for (let r = minR; r <= maxR; r++) path.push([r, fromCol])
  }
  return path
}

function findCaptorIds(capturedPieces: Piece[], resultPieces: Piece[], movedIsDefender: boolean): string[] {
  const ids = new Set<string>()
  for (const cap of capturedPieces) {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      const nb = resultPieces.find(p => p.row === cap.row + dr && p.col === cap.col + dc)
      if (nb) {
        const nbIsDefender = nb.type === 'defender' || nb.type === 'king'
        if (nbIsDefender === movedIsDefender) ids.add(nb.id)
      }
    }
  }
  return ids.size > 0 ? [...ids] : []
}

export type Theme = 'natural'
export type PlayerSide = 'attacker' | 'defender'
export type GameMode = 'attacker' | 'defender' | '2player'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Rules = 'Copenhagen' | 'Fetlar' | 'Historical' | 'Tawlbwrdd' | 'Linnaeus Tablut' | 'Saami Tablut' | 'Brandub' | 'Ard Rí' | 'Alea Evangelii' | 'Tyr' | 'Simple Tyr'

interface HistoryEntry {
  pieces: Piece[]
  currentTurn: PlayerSide
  scores: Record<PlayerSide, number>
  posKey: string  // position key AFTER this move (used for repetition detection)
}

interface GameStore {
  pieces: Piece[]
  dyingPieces: Piece[]
  captorIds: string[]
  captureDelayMs: number
  selectedId: string | null
  validMoves: [number, number][]
  cautionMoves: [number, number][]  // valid moves that would create a 2nd repetition
  winner: PlayerSide | null
  winReason: WinReason | null
  repetitionWarning: { pieceId: string; toRow: number; toCol: number } | null
  theme: Theme
  currentTurn: PlayerSide
  scores: Record<PlayerSide, number>
  gameKey: number
  history: HistoryEntry[]
  undoTrigger: number
  lastMoveTarget: { row: number; col: number } | null
  lastMove: { pieceId: string; fromRow: number; fromCol: number; toRow: number; toCol: number } | null
  lastMovePath: [number, number][]
  // Settings
  musicEnabled: boolean
  cameraLocked: boolean
  difficulty: Difficulty
  rules: Rules
  powerSaving: boolean
  playerMode: GameMode
  roleSelectOpen: boolean
  setRoleSelectOpen: (open: boolean) => void
  // Auth
  userId: string | null
  username: string | null
  elo: number | null
  avatar: import('../lib/avatarConfig').AvatarConfig | null
  authReady: boolean
  setAuth: (userId: string | null, username: string | null, elo?: number | null, avatar?: import('../lib/avatarConfig').AvatarConfig | null) => void
  setAuthReady: (ready: boolean) => void
  setUsername: (username: string) => void
  setElo: (elo: number) => void
  setAvatar: (avatar: import('../lib/avatarConfig').AvatarConfig) => void
  setTheme: (theme: Theme) => void
  cursor: { row: number; col: number }
  lastMoveText: string  // narration for the aria-live region
  moveCursor: (dRow: number, dCol: number) => void
  setCursor: (row: number, col: number) => void
  activateCursor: () => void
  selectPiece: (id: string | null) => void
  movePiece: (toRow: number, toCol: number) => void
  confirmRepetitionMove: () => void
  cancelRepetitionMove: () => void
  machineMove: (pieceId: string, toRow: number, toCol: number) => void
  clearDyingPieces: () => void
  setPieces: (pieces: Piece[]) => void
  resetGame: () => void
  resetPiecesOnly: () => void
  undoMove: () => void
  setPlayerMode: (mode: GameMode) => void
  boardSize: number
  setSetting: <K extends 'musicEnabled' | 'cameraLocked' | 'difficulty' | 'rules' | 'powerSaving' | 'boardSize' | 'playerMode'>(
    key: K, value: GameStore[K]
  ) => void
}

// Subscribe to a subset of the store with shallow comparison. Prefer this over
// selector-less useGameStore() — that subscribes to EVERY state change and
// re-renders the component on each animation tick / move / capture.
export function useGameSlice<K extends keyof GameStore>(...keys: K[]): Pick<GameStore, K> {
  return useGameStore(useShallow(s => {
    const out = {} as Pick<GameStore, K>
    for (const k of keys) out[k] = s[k]
    return out
  }))
}

// How many undo snapshots survive a refresh — keeps localStorage well under
// quota on big boards (full history lives in memory during the session)
const PERSISTED_HISTORY = 20

// A starting board for `config` — the fields every reset path shares.
function freshBoardState(config: BoardConfig) {
  return {
    pieces: createInitialPieces(config),
    dyingPieces: [],
    captorIds: [],
    selectedId: null,
    validMoves: [],
    cautionMoves: [],
    winner: null,
    winReason: null,
    repetitionWarning: null,
    currentTurn: (config.attackerFirst ? 'attacker' : 'defender') as PlayerSide,
    cursor: { row: config.center, col: config.center },
    lastMoveText: '',
    scores: { attacker: 0, defender: 0 },
    history: [],
    lastMoveTarget: null,
    undoTrigger: 0,
  }
}

// Could `pieces` have come from this board? Guards the rehydrate path, where
// restored settings and restored pieces are written separately.
function piecesMatchConfig(pieces: Piece[], config: BoardConfig): boolean {
  if (!Array.isArray(pieces) || pieces.length === 0) return false
  if (pieces.length > config.attackerStarts.length + config.defenderStarts.length + 1) return false
  if (pieces.filter(p => p.type === 'king').length !== 1) return false
  return pieces.every(p =>
    p.row >= 0 && p.row < config.boardSize &&
    p.col >= 0 && p.col < config.boardSize
  )
}

export const useGameStore = create<GameStore>()(persist((set) => ({
  pieces: createInitialPieces(getBoardConfig('Copenhagen', 11)),
  dyingPieces: [],
  captorIds: [],
  captureDelayMs: 450,
  selectedId: null,
  validMoves: [],
  cautionMoves: [],
  cursor: { row: 5, col: 5 },
  lastMoveText: '',
  winner: null,
  winReason: null,
  repetitionWarning: null,
  theme: 'natural',
  currentTurn: 'defender',
  scores: { attacker: 0, defender: 0 },
  gameKey: 0,
  history: [],
  undoTrigger: 0,
  lastMoveTarget: null,
  lastMove: null,
  lastMovePath: [],
  musicEnabled: true,
  cameraLocked: false,
  difficulty: 'medium',
  rules: 'Copenhagen',
  boardSize: 11,
  powerSaving: false,
  playerMode: 'defender' as GameMode,
  roleSelectOpen: false,
  setRoleSelectOpen: (open) => set({ roleSelectOpen: open }),
  userId: null,
  username: null,
  elo: null,
  avatar: null,
  authReady: false,
  setAuth: (userId, username, elo = null, avatar = null) => set({ userId, username, elo, avatar }),
  setAuthReady: (ready) => set({ authReady: ready }),
  setUsername: (username) => set({ username }),
  setElo: (elo) => set({ elo }),
  setAvatar: (avatar) => set({ avatar }),

  setTheme: (theme) => set({ theme }),

  setCursor: (row, col) => set((s) => {
    const { boardSize } = getBoardConfig(s.rules, s.boardSize)
    const clamp = (v: number) => Math.min(Math.max(v, 0), boardSize - 1)
    return { cursor: { row: clamp(row), col: clamp(col) } }
  }),

  moveCursor: (dRow, dCol) => set((s) => {
    const { boardSize } = getBoardConfig(s.rules, s.boardSize)
    const clamp = (v: number) => Math.min(Math.max(v, 0), boardSize - 1)
    return { cursor: { row: clamp(s.cursor.row + dRow), col: clamp(s.cursor.col + dCol) } }
  }),

  // Enter/Space on the cursor square. Mirrors what a click on that square does:
  // commit a move if it's a valid target, otherwise pick up a piece, otherwise
  // drop the current selection.
  activateCursor: () => {
    const s = useGameStore.getState()
    if (s.winner) return
    const { row, col } = s.cursor
    if (s.selectedId && s.validMoves.some(([r, c]) => r === row && c === col)) {
      s.movePiece(row, col)
      return
    }
    const here = s.pieces.find(p => p.row === row && p.col === col)
    if (here) s.selectPiece(here.id === s.selectedId ? null : here.id)
    else if (s.selectedId) s.selectPiece(null)
  },

  selectPiece: (id) => set((s) => {
    if (s.winner) return s
    if (!id) return { selectedId: null, validMoves: [], cautionMoves: [] }
    if (id === s.selectedId) return { selectedId: null, validMoves: [], cautionMoves: [] }

    const piece = s.pieces.find(p => p.id === id)
    if (!piece) return { selectedId: null, validMoves: [], cautionMoves: [] }

    const pieceIsDefender = piece.type === 'defender' || piece.type === 'king'
    const correctTurn =
      (s.currentTurn === 'defender' && pieceIsDefender) ||
      (s.currentTurn === 'attacker' && piece.type === 'attacker')
    if (!correctTurn) return s

    // In vs-machine mode, block the human from moving the machine's pieces
    if (s.playerMode !== '2player') {
      const humanIsDefender = s.playerMode === 'defender'
      if (humanIsDefender && !pieceIsDefender) return s
      if (!humanIsDefender && pieceIsDefender) return s
    }

    const { boardSize, center, noThrone, kingEscapeEdge, shieldwall, weakKing } = getBoardConfig(s.rules, s.boardSize)
    const validMoves = getValidMoves(piece, s.pieces, boardSize, center, noThrone)
    const nextTurn = s.currentTurn === 'defender' ? 'attacker' : 'defender'
    const keys = historyKeys(s.history)
    const cautionMoves = validMoves.filter(([r, c]) => {
      const result = applyMove(s.pieces, piece.id, r, c, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)
      const key = positionKey(result.pieces, nextTurn)
      return keys.filter(k => k === key).length === 1  // would be 2nd occurrence
    })
    return { selectedId: id, validMoves, cautionMoves }
  }),

  movePiece: (toRow, toCol) => set((s) => {
    if (!s.selectedId || s.winner) return s
    if (!s.validMoves.some(([r, c]) => r === toRow && c === toCol)) return s

    const { boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone } = getBoardConfig(s.rules, s.boardSize)
    // Exclude any still-dying pieces from move logic — they're logically already gone
    const activePieces = s.pieces.filter(p => !s.dyingPieces.some(d => d.id === p.id))
    const result = applyMove(activePieces, s.selectedId, toRow, toCol, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)
    const capturedPieces = activePieces.filter(p => result.capturedIds.includes(p.id))

    // Repetition check: if the resulting position has appeared twice already, warn before committing
    if (!result.winner) {
      const nextTurn = s.currentTurn === 'defender' ? 'attacker' : 'defender'
      const key = positionKey(result.pieces, nextTurn)
      const seen = s.history.filter(h => h.posKey === key).length
      if (seen >= 2) return { ...s, repetitionWarning: { pieceId: s.selectedId!, toRow, toCol } }
    }

    const movedPiece = activePieces.find(p => p.id === s.selectedId)!
    const movedIsDefender = movedPiece.type === 'defender' || movedPiece.type === 'king'
    const moveDist = Math.abs(toRow - movedPiece.row) + Math.abs(toCol - movedPiece.col)
    const captureDelayMs = Math.round(Math.max(500, moveDist * 280) + 80)

    const nextTurn = s.currentTurn === 'defender' ? 'attacker' : 'defender'
    const livingPieces = result.pieces
    const stalemateWinner = !result.winner && !hasMoves(nextTurn, livingPieces, boardSize, center, noThrone)
      ? (nextTurn === 'attacker' ? 'defender' : 'attacker') as 'attacker' | 'defender'
      : null
    const snapshot: HistoryEntry = { pieces: activePieces, currentTurn: s.currentTurn, scores: s.scores, posKey: positionKey(result.pieces, nextTurn) }

    return {
      pieces: [...result.pieces, ...capturedPieces],
      dyingPieces: capturedPieces,
      captureDelayMs,
      captorIds: findCaptorIds(capturedPieces, result.pieces, movedIsDefender),
      selectedId: null,
      validMoves: [],
      cautionMoves: [],
      currentTurn: nextTurn,
      repetitionWarning: null,
      scores: {
        attacker: s.scores.attacker + (s.currentTurn === 'attacker' ? capturedPieces.length : 0),
        defender: s.scores.defender + (s.currentTurn === 'defender' ? capturedPieces.length : 0),
      },
      winner: result.winner ?? stalemateWinner,
      winReason: result.winner ? result.winReason : (stalemateWinner ? 'stalemate' : null),
      history: [...s.history, snapshot],
      lastMoveTarget: { row: toRow, col: toCol },
      lastMoveText: describeMove({ row: movedPiece.row, col: movedPiece.col }, { row: toRow, col: toCol }, movedPiece, capturedPieces, boardSize),
      lastMove: { pieceId: s.selectedId!, fromRow: movedPiece.row, fromCol: movedPiece.col, toRow, toCol },
      lastMovePath: [],
    }
  }),

  confirmRepetitionMove: () => set((s) => {
    if (!s.repetitionWarning) return s
    // Execute the repeated move but immediately forfeit to the opponent
    const { pieceId: warningPieceId, toRow, toCol } = s.repetitionWarning
    const { boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone } = getBoardConfig(s.rules, s.boardSize)
    const activePieces = s.pieces.filter(p => !s.dyingPieces.some(d => d.id === p.id))
    const result = applyMove(activePieces, warningPieceId, toRow, toCol, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)
    const capturedPieces = activePieces.filter(p => result.capturedIds.includes(p.id))
    const movedPiece = activePieces.find(p => p.id === warningPieceId)!
    const movedIsDefender = movedPiece.type === 'defender' || movedPiece.type === 'king'
    const moveDist = Math.abs(toRow - movedPiece.row) + Math.abs(toCol - movedPiece.col)
    const captureDelayMs = Math.round(Math.max(500, moveDist * 280) + 80)
    const nextTurn = s.currentTurn === 'defender' ? 'attacker' : 'defender'
    const snapshot: HistoryEntry = { pieces: activePieces, currentTurn: s.currentTurn, scores: s.scores, posKey: positionKey(result.pieces, nextTurn) }
    return {
      pieces: [...result.pieces, ...capturedPieces],
      dyingPieces: capturedPieces,
      captureDelayMs,
      captorIds: findCaptorIds(capturedPieces, result.pieces, movedIsDefender),
      selectedId: null,
      validMoves: [],
      cautionMoves: [],
      currentTurn: nextTurn,
      repetitionWarning: null,
      scores: {
        attacker: s.scores.attacker + (s.currentTurn === 'attacker' ? capturedPieces.length : 0),
        defender: s.scores.defender + (s.currentTurn === 'defender' ? capturedPieces.length : 0),
      },
      winner: nextTurn,  // the mover forfeits; opponent wins
      winReason: 'repetition' as WinReason,
      history: [...s.history, snapshot],
      lastMoveTarget: { row: toRow, col: toCol },
      lastMoveText: describeMove({ row: movedPiece.row, col: movedPiece.col }, { row: toRow, col: toCol }, movedPiece, capturedPieces, boardSize),
      lastMove: { pieceId: warningPieceId, fromRow: movedPiece.row, fromCol: movedPiece.col, toRow, toCol },
      lastMovePath: [],
    }
  }),

  cancelRepetitionMove: () => set(() => ({
    repetitionWarning: null,
    selectedId: null,
    validMoves: [],
    cautionMoves: [],
  })),

  machineMove: (pieceId, toRow, toCol) => set((s) => {
    if (s.winner) return s
    const { boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone } = getBoardConfig(s.rules, s.boardSize)
    const activePieces = s.pieces.filter(p => !s.dyingPieces.some(d => d.id === p.id))
    const result = applyMove(activePieces, pieceId, toRow, toCol, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)
    const capturedPieces = activePieces.filter(p => result.capturedIds.includes(p.id))

    const movedPiece = activePieces.find(p => p.id === pieceId)!
    const movedIsDefender = movedPiece.type === 'defender' || movedPiece.type === 'king'
    const moveDist = Math.abs(toRow - movedPiece.row) + Math.abs(toCol - movedPiece.col)
    const captureDelayMs = Math.round(Math.max(500, moveDist * 280) + 80)

    const nextTurn = s.currentTurn === 'defender' ? 'attacker' : 'defender'
    const livingPieces = result.pieces
    const stalemateWinner = !result.winner && !hasMoves(nextTurn, livingPieces, boardSize, center, noThrone)
      ? (nextTurn === 'attacker' ? 'defender' : 'attacker') as 'attacker' | 'defender'
      : null
    const posKey = positionKey(result.pieces, nextTurn)
    const repCount = s.history.filter(h => h.posKey === posKey).length
    const repetitionWinner = !result.winner && repCount >= 2
      ? nextTurn as 'attacker' | 'defender'  // AI forfeits — the incoming player wins
      : null
    const snapshot: HistoryEntry = { pieces: activePieces, currentTurn: s.currentTurn, scores: s.scores, posKey }

    return {
      pieces: [...result.pieces, ...capturedPieces],
      dyingPieces: capturedPieces,
      captureDelayMs,
      captorIds: findCaptorIds(capturedPieces, result.pieces, movedIsDefender),
      selectedId: null,
      validMoves: [],
      cautionMoves: [],
      currentTurn: nextTurn,
      scores: {
        attacker: s.scores.attacker + (s.currentTurn === 'attacker' ? capturedPieces.length : 0),
        defender: s.scores.defender + (s.currentTurn === 'defender' ? capturedPieces.length : 0),
      },
      winner: result.winner ?? stalemateWinner ?? repetitionWinner,
      winReason: result.winner
        ? result.winReason
        : stalemateWinner ? 'stalemate' : repetitionWinner ? 'repetition' : null,
      history: [...s.history, snapshot],
      lastMoveText: describeMove({ row: movedPiece.row, col: movedPiece.col }, { row: toRow, col: toCol }, movedPiece, capturedPieces, boardSize),
      lastMovePath: computeMovePath(movedPiece.row, movedPiece.col, toRow, toCol),
    }
  }),

  clearDyingPieces: () => set((s) => ({
    pieces: s.pieces.filter(p => !s.dyingPieces.find(dp => dp.id === p.id)),
    dyingPieces: [],
    captorIds: [],
  })),

  setPlayerMode: (mode) => set({ playerMode: mode }),

  undoMove: () => set((s) => {
    if (s.history.length === 0) return s
    // Rewind to the human's last turn so they can play something different.
    // History records every move (repetition detection needs the full position
    // list), so against the machine a single pop would land on the machine's
    // turn and it would just replay its move.
    let idx = s.history.length - 1
    if (s.playerMode !== '2player') {
      while (idx >= 0 && s.history[idx].currentTurn !== s.playerMode) idx--
      if (idx < 0) return s  // machine has opened but the human hasn't moved yet
    }
    const prev = s.history[idx]
    return {
      ...prev,
      history: s.history.slice(0, idx),
      dyingPieces: [],
      captorIds: [],
      selectedId: null,
      validMoves: [],
      cautionMoves: [],
      repetitionWarning: null,
      winner: null,
      winReason: null,
      lastMoveText: '',
      lastMovePath: [],
      undoTrigger: s.undoTrigger + 1,
    }
  }),

  resetGame: () => set((s) => ({
    ...freshBoardState(getBoardConfig(s.rules, s.boardSize)),
    gameKey: s.gameKey + 1,
    lastMove: null,
    lastMovePath: [],
  })),

  setPieces: (pieces) => set({ pieces, dyingPieces: [], selectedId: null, validMoves: [], cautionMoves: [] }),

  resetPiecesOnly: () => set((s) => freshBoardState(getBoardConfig(s.rules, s.boardSize))),

  setSetting: (key, value) => set({ [key]: value }),
}), {
  name: 'highkings',
  version: 1,
  // Keep the restored board and the restored rules/boardSize in step.
  //
  // A saved board is written atomically with the settings, so whenever `pieces`
  // is present it already belongs to those settings. When it's absent — the game
  // had finished, so partialize skipped it — the store keeps its initial 11×11
  // Copenhagen pieces, which would otherwise end up on whatever variant the
  // settings restore. Rebuild for the restored config in that case.
  //
  // Done here rather than in onRehydrateStorage: localStorage is synchronous, so
  // rehydration runs during store creation and that callback can't reach
  // useGameStore yet (TDZ).
  merge: (persisted, current) => {
    const saved = (persisted ?? {}) as Partial<GameStore>
    const merged = { ...current, ...saved }
    const config = getBoardConfig(merged.rules, merged.boardSize)
    // The cursor is ephemeral UI state and isn't persisted, so the initial
    // value would otherwise leak onto a restored board of a different size.
    merged.cursor = { row: config.center, col: config.center }
    if (saved.pieces && piecesMatchConfig(merged.pieces, config)) return merged
    return { ...merged, ...freshBoardState(config) }
  },
  partialize: (s) => ({
    // Settings always persist
    musicEnabled: s.musicEnabled,
    cameraLocked: s.cameraLocked,
    difficulty: s.difficulty,
    rules: s.rules,
    boardSize: s.boardSize,
    powerSaving: s.powerSaving,
    playerMode: s.playerMode,
    theme: s.theme,
    // In-progress local game survives a refresh; finished games start fresh
    ...(s.winner === null ? {
      pieces: s.pieces.filter(p => !s.dyingPieces.some(d => d.id === p.id)),
      currentTurn: s.currentTurn,
      scores: s.scores,
      history: s.history.slice(-PERSISTED_HISTORY),
    } : {}),
  }),
}))
