import { create } from 'zustand'
import { createInitialPieces } from '../game/hnefatafl'
import type { Piece } from '../game/hnefatafl'

export type Theme = 'natural'
export type PlayerSide = 'attacker' | 'defender'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Rules = 'Tablut' | 'Copenhagen' | 'Tawlbwrdd' | 'Brandub'

interface GameStore {
  pieces: Piece[]
  selectedId: string | null
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
  resetGame: () => void
  setSetting: <K extends 'musicEnabled' | 'cameraLocked' | 'difficulty' | 'rules' | 'powerSaving'>(
    key: K, value: GameStore[K]
  ) => void
}

export const useGameStore = create<GameStore>((set) => ({
  pieces: createInitialPieces(),
  selectedId: null,
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
  selectPiece: (id) => set({ selectedId: id }),
  resetGame: () => set((s) => ({
    pieces: createInitialPieces(),
    selectedId: null,
    currentTurn: 'defender',
    scores: { attacker: 0, defender: 0 },
    gameKey: s.gameKey + 1,
  })),
  setSetting: (key, value) => set({ [key]: value }),
}))
