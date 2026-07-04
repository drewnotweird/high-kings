import { create } from 'zustand'
import { createInitialPieces, getBoardConfig, getValidMoves, applyMove } from '../game/hnefatafl'
import type { Piece } from '../game/hnefatafl'

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
}

interface GameStore {
  pieces: Piece[]
  dyingPieces: Piece[]
  captorIds: string[]
  captureDelayMs: number
  selectedId: string | null
  validMoves: [number, number][]
  winner: PlayerSide | null
  theme: Theme
  currentTurn: PlayerSide
  scores: Record<PlayerSide, number>
  gameKey: number
  history: HistoryEntry[]
  undoTrigger: number
  lastMoveTarget: { row: number; col: number } | null
  lastMove: { pieceId: string; toRow: number; toCol: number } | null
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
  authReady: boolean
  setAuth: (userId: string | null, username: string | null, elo?: number | null) => void
  setAuthReady: (ready: boolean) => void
  setUsername: (username: string) => void
  setElo: (elo: number) => void
  setTheme: (theme: Theme) => void
  selectPiece: (id: string | null) => void
  movePiece: (toRow: number, toCol: number) => void
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

export const useGameStore = create<GameStore>((set) => ({
  pieces: createInitialPieces(getBoardConfig('Copenhagen', 11)),
  dyingPieces: [],
  captorIds: [],
  captureDelayMs: 450,
  selectedId: null,
  validMoves: [],
  winner: null,
  theme: 'natural',
  currentTurn: 'defender',
  scores: { attacker: 0, defender: 0 },
  gameKey: 0,
  history: [],
  undoTrigger: 0,
  lastMoveTarget: null,
  lastMove: null,
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
  authReady: false,
  setAuth: (userId, username, elo = null) => set({ userId, username, elo }),
  setAuthReady: (ready) => set({ authReady: ready }),
  setUsername: (username) => set({ username }),
  setElo: (elo) => set({ elo }),

  setTheme: (theme) => set({ theme }),

  selectPiece: (id) => set((s) => {
    if (s.winner) return s
    if (!id) return { selectedId: null, validMoves: [] }
    if (id === s.selectedId) return { selectedId: null, validMoves: [] }

    const piece = s.pieces.find(p => p.id === id)
    if (!piece) return { selectedId: null, validMoves: [] }

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

    const { boardSize, center, noThrone } = getBoardConfig(s.rules, s.boardSize)
    const validMoves = getValidMoves(piece, s.pieces, boardSize, center, noThrone)
    return { selectedId: id, validMoves }
  }),

  movePiece: (toRow, toCol) => set((s) => {
    if (!s.selectedId || s.winner) return s
    if (!s.validMoves.some(([r, c]) => r === toRow && c === toCol)) return s

    const { boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone } = getBoardConfig(s.rules, s.boardSize)
    // Exclude any still-dying pieces from move logic — they're logically already gone
    const activePieces = s.pieces.filter(p => !s.dyingPieces.some(d => d.id === p.id))
    const result = applyMove(activePieces, s.selectedId, toRow, toCol, boardSize, center, kingEscapeEdge, shieldwall, weakKing, noThrone)
    const capturedPieces = activePieces.filter(p => result.capturedIds.includes(p.id))

    const movedPiece = activePieces.find(p => p.id === s.selectedId)!
    const movedIsDefender = movedPiece.type === 'defender' || movedPiece.type === 'king'
    const moveDist = Math.abs(toRow - movedPiece.row) + Math.abs(toCol - movedPiece.col)
    const captureDelayMs = Math.round(Math.max(500, moveDist * 280) + 80)

    const snapshot: HistoryEntry = { pieces: activePieces, currentTurn: s.currentTurn, scores: s.scores }

    return {
      pieces: [...result.pieces, ...capturedPieces],
      dyingPieces: capturedPieces,
      captureDelayMs,
      captorIds: findCaptorIds(capturedPieces, result.pieces, movedIsDefender),
      selectedId: null,
      validMoves: [],
      currentTurn: s.currentTurn === 'defender' ? 'attacker' : 'defender',
      scores: {
        attacker: s.scores.attacker + (s.currentTurn === 'attacker' ? capturedPieces.length : 0),
        defender: s.scores.defender + (s.currentTurn === 'defender' ? capturedPieces.length : 0),
      },
      winner: result.winner,
      history: [snapshot],
      lastMoveTarget: { row: toRow, col: toCol },
      lastMove: { pieceId: s.selectedId!, toRow, toCol },
    }
  }),

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

    return {
      pieces: [...result.pieces, ...capturedPieces],
      dyingPieces: capturedPieces,
      captureDelayMs,
      captorIds: findCaptorIds(capturedPieces, result.pieces, movedIsDefender),
      selectedId: null,
      validMoves: [],
      currentTurn: s.currentTurn === 'defender' ? 'attacker' : 'defender',
      scores: {
        attacker: s.scores.attacker + (s.currentTurn === 'attacker' ? capturedPieces.length : 0),
        defender: s.scores.defender + (s.currentTurn === 'defender' ? capturedPieces.length : 0),
      },
      winner: result.winner,
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
    const prev = s.history[s.history.length - 1]
    return {
      ...prev,
      history: s.history.slice(0, -1),
      dyingPieces: [],
      captorIds: [],
      selectedId: null,
      validMoves: [],
      winner: null,
      undoTrigger: s.undoTrigger + 1,
    }
  }),

  resetGame: () => set((s) => ({
    pieces: createInitialPieces(getBoardConfig(s.rules, s.boardSize)),
    dyingPieces: [],
    captorIds: [],
    selectedId: null,
    validMoves: [],
    winner: null,
    currentTurn: 'defender',
    scores: { attacker: 0, defender: 0 },
    gameKey: s.gameKey + 1,
    history: [],
    lastMoveTarget: null,
    undoTrigger: 0,
  })),

  setPieces: (pieces) => set({ pieces, dyingPieces: [], selectedId: null, validMoves: [] }),

  resetPiecesOnly: () => set((s) => ({
    pieces: createInitialPieces(getBoardConfig(s.rules, s.boardSize)),
    dyingPieces: [],
    captorIds: [],
    selectedId: null,
    validMoves: [],
    winner: null,
    currentTurn: 'defender',
    scores: { attacker: 0, defender: 0 },
    history: [],
    lastMoveTarget: null,
    undoTrigger: 0,
  })),

  setSetting: (key, value) => set({ [key]: value }),
}))
