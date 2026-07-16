// Promise wrapper around the AI Web Worker (see aiWorker.ts).
// Callers must re-check game state when the promise resolves — the position
// may have changed (undo, new game, opponent move) while the search ran.
import type { AiMove } from './ai'
import type { Piece } from './hnefatafl'

export interface AiSearchParams {
  pieces: Piece[]
  side: 'attacker' | 'defender'
  boardSize: number
  center: number
  difficulty: 'easy' | 'medium' | 'hard'
  kingEscapeEdge?: boolean
  shieldwall?: boolean
  weakKing?: boolean
  noThrone?: boolean
  positionHistory: string[]
}

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, (move: AiMove | null) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ requestId: number; move: AiMove | null }>) => {
      pending.get(e.data.requestId)?.(e.data.move)
      pending.delete(e.data.requestId)
    }
    worker.onerror = (err) => {
      console.error('AI worker error:', err.message)
      pending.forEach(resolve => resolve(null))
      pending.clear()
    }
  }
  return worker
}

export function requestBestMove(params: AiSearchParams): Promise<AiMove | null> {
  return new Promise(resolve => {
    const requestId = nextId++
    pending.set(requestId, resolve)
    getWorker().postMessage({ requestId, ...params })
  })
}
