import { create } from 'zustand'
import { createInitialPieces, getBoardConfig, getValidMoves, applyMove } from '../game/hnefatafl'
import type { Piece } from '../game/hnefatafl'

export type Theme = 'natural'
export type PlayerSide = 'attacker' | 'defender'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Rules = 'Tablut' | 'Copenhagen' | 'Tawlbwrdd' | 'Brandub'

interface GameStore {
  pieces: Piece[]
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
  setTheme: (theme: Theme) => void
  selectPiece: (id: string | null) => void
  movePiece: (toRow: number, toCol: number) => void
  resetGame: () => void
  setSetting: <K extends 'musicEnabled' | 'cameraLocked' | 'difficulty' | 'rules' | 'powerSaving'>(
    key: K, value: GameStore[K]
  ) => void
}

export const useGameStore = create<GameStore>((set) => ({
  pieces: createInitialPieces(getBoardConfig('Copenhagen')),
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
  rules: 'Copenhagen' as Rules,
  powerSaving: false,

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
    if (!correctTurn) return { selectedId: null, validMoves: [] }

    const { boardSize, center } = getBoardConfig(s.rules)
    const validMoves = getValidMoves(piece, s.pieces, boardSize, center)
    return { selectedId: id, validMoves }
  }),

  movePiece: (toRow, toCol) => set((s) => {
    if (!s.selectedId || s.winner) return s
    if (!s.validMoves.some(([r, c]) => r === toRow && c === toCol)) return s

    const { boardSize, center } = getBoardConfig(s.rules)
    const result = applyMove(s.pieces, s.selectedId, toRow, toCol, boardSize, center)
    const capturedCount = result.capturedIds.length

    return {
      pieces: result.pieces,
      selectedId: null,
      validMoves: [],
      currentTurn: s.currentTurn === 'defender' ? 'attacker' : 'defender',
      scores: {
        attacker: s.scores.attacker + (s.currentTurn === 'attacker' ? capturedCount : 0),
        defender: s.scores.defender + (s.currentTurn === 'defender' ? capturedCount : 0),
      },
      winner: result.winner,
    }
  }),

  resetGame: () => set((s) => ({
    pieces: createInitialPieces(getBoardConfig(s.rules)),
    selectedId: null,
    validMoves: [],
    winner: null,
    currentTurn: 'defender',
    scores: { attacker: 0, defender: 0 },
    gameKey: s.gameKey + 1,
  })),

  setSetting: (key, value) => set({ [key]: value }),
}))
