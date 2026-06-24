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
export type Rules = 'Copenhagen' | 'Tawlbwrdd' | 'Linnaeus Tablut' | 'Saami Tablut' | 'Brandub' | 'Ard Rí'

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
  // Settings
  musicEnabled: boolean
  cameraLocked: boolean
  difficulty: Difficulty
  rules: Rules
  powerSaving: boolean
  playerMode: GameMode
  setTheme: (theme: Theme) => void
  selectPiece: (id: string | null) => void
  movePiece: (toRow: number, toCol: number) => void
  machineMove: (pieceId: string, toRow: number, toCol: number) => void
  clearDyingPieces: () => void
  resetGame: () => void
  setPlayerMode: (mode: GameMode) => void
  setSetting: <K extends 'musicEnabled' | 'cameraLocked' | 'difficulty' | 'rules' | 'powerSaving'>(
    key: K, value: GameStore[K]
  ) => void
}

export const useGameStore = create<GameStore>((set) => ({
  pieces: createInitialPieces(getBoardConfig('Copenhagen')),
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
  musicEnabled: true,
  cameraLocked: false,
  difficulty: 'medium',
  rules: 'Copenhagen',
  powerSaving: false,
  playerMode: 'defender' as GameMode,

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

    const { boardSize, center } = getBoardConfig(s.rules)
    const validMoves = getValidMoves(piece, s.pieces, boardSize, center)
    return { selectedId: id, validMoves }
  }),

  movePiece: (toRow, toCol) => set((s) => {
    if (!s.selectedId || s.winner) return s
    if (!s.validMoves.some(([r, c]) => r === toRow && c === toCol)) return s

    const { boardSize, center, kingEscapeEdge, shieldwall, weakKing } = getBoardConfig(s.rules)
    // Exclude any still-dying pieces from move logic — they're logically already gone
    const activePieces = s.pieces.filter(p => !s.dyingPieces.some(d => d.id === p.id))
    const result = applyMove(activePieces, s.selectedId, toRow, toCol, boardSize, center, kingEscapeEdge, shieldwall, weakKing)
    const capturedPieces = activePieces.filter(p => result.capturedIds.includes(p.id))

    const movedPiece = activePieces.find(p => p.id === s.selectedId)!
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

  machineMove: (pieceId, toRow, toCol) => set((s) => {
    if (s.winner) return s
    const { boardSize, center, kingEscapeEdge, shieldwall, weakKing } = getBoardConfig(s.rules)
    const activePieces = s.pieces.filter(p => !s.dyingPieces.some(d => d.id === p.id))
    const result = applyMove(activePieces, pieceId, toRow, toCol, boardSize, center, kingEscapeEdge, shieldwall, weakKing)
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

  resetGame: () => set((s) => ({
    pieces: createInitialPieces(getBoardConfig(s.rules)),
    dyingPieces: [],
    captorIds: [],
    selectedId: null,
    validMoves: [],
    winner: null,
    currentTurn: 'defender',
    scores: { attacker: 0, defender: 0 },
    gameKey: s.gameKey + 1,
  })),

  setSetting: (key, value) => set({ [key]: value }),
}))
