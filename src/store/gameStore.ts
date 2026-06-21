import { create } from 'zustand'
import { createInitialPieces } from '../game/hnefatafl'
import type { Piece } from '../game/hnefatafl'

export type Theme = 'natural'
export type PlayerSide = 'attacker' | 'defender'

interface GameStore {
  pieces: Piece[]
  selectedId: string | null
  theme: Theme
  currentTurn: PlayerSide
  scores: Record<PlayerSide, number>
  setTheme: (theme: Theme) => void
  selectPiece: (id: string | null) => void
}

export const useGameStore = create<GameStore>((set) => ({
  pieces: createInitialPieces(),
  selectedId: null,
  theme: 'natural',
  currentTurn: 'defender',
  scores: { attacker: 0, defender: 0 },
  setTheme: (theme) => set({ theme }),
  selectPiece: (id) => set({ selectedId: id }),
}))
