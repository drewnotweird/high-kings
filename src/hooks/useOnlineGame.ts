import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store/gameStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type OnlineStatus =
  | { type: 'idle' }
  | { type: 'matched'; gameId: string; opponentName: string; opponentElo: number | null }
  | { type: 'opponent_disconnected'; secondsLeft: number }
  | { type: 'ended' }

type MoveEvent = { type: 'move'; seq: number; pieceId: string; toRow: number; toCol: number }
type NameEvent = { type: 'opponent_name'; name: string; elo: number | null }

interface OnlineGameState {
  gameId: string | null
  mySide: 'attacker' | 'defender' | null
  seq: number
  disconnectTimer: ReturnType<typeof setTimeout> | null
  channel: RealtimeChannel | null
}

export function useOnlineGame(
  onStatusChange: (status: OnlineStatus) => void,
) {
  const { machineMove, pieces, userId, username, elo } = useGameStore()
  const state = useRef<OnlineGameState>({
    gameId: null,
    mySide: null,
    seq: 0,
    disconnectTimer: null,
    channel: null,
  })

  const cleanup = useCallback(() => {
    if (state.current.disconnectTimer) clearTimeout(state.current.disconnectTimer)
    state.current.disconnectTimer = null
    if (state.current.channel) {
      supabase.removeChannel(state.current.channel)
      state.current.channel = null
    }
  }, [])

  const joinGameChannel = useCallback((gameId: string, mySide: 'attacker' | 'defender') => {
    state.current.gameId = gameId
    state.current.mySide = mySide
    state.current.seq = 0

    const channel = supabase.channel(`game:${gameId}`, { config: { broadcast: { self: false } } })
    state.current.channel = channel

    channel
      .on('broadcast', { event: 'move' }, ({ payload }: { payload: MoveEvent }) => {
        const expected = state.current.seq + 1
        if (payload.seq !== expected) {
          channel.send({ type: 'broadcast', event: 'resync_request', payload: { type: 'resync_request' } })
          return
        }
        state.current.seq = payload.seq
        machineMove(payload.pieceId, payload.toRow, payload.toCol)
      })
      .on('broadcast', { event: 'resync_request' }, () => {
        channel.send({
          type: 'broadcast',
          event: 'resync',
          payload: { type: 'resync', seq: state.current.seq, pieces },
        })
      })
      .on('broadcast', { event: 'opponent_name' }, ({ payload }: { payload: NameEvent }) => {
        onStatusChange({ type: 'matched', gameId, opponentName: payload.name, opponentElo: payload.elo ?? null })
      })
      .on('presence', { event: 'leave' }, () => {
        let secondsLeft = 30
        onStatusChange({ type: 'opponent_disconnected', secondsLeft })
        state.current.disconnectTimer = setInterval(() => {
          secondsLeft -= 1
          if (secondsLeft <= 0) {
            clearInterval(state.current.disconnectTimer!)
            state.current.disconnectTimer = null
            supabase.from('games').update({ status: 'abandoned', winner_id: userId, ended_at: new Date().toISOString() }).eq('id', gameId)
            onStatusChange({ type: 'ended' })
          } else {
            onStatusChange({ type: 'opponent_disconnected', secondsLeft })
          }
        }, 1000) as unknown as ReturnType<typeof setTimeout>
      })
      .on('presence', { event: 'join' }, () => {
        if (state.current.disconnectTimer) {
          clearInterval(state.current.disconnectTimer)
          state.current.disconnectTimer = null
        }
        onStatusChange({ type: 'matched', gameId, opponentName: '', opponentElo: null })
        channel.send({ type: 'broadcast', event: 'opponent_name', payload: { type: 'opponent_name', name: username ?? 'Unknown', elo: elo ?? null } })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, username })
          channel.send({ type: 'broadcast', event: 'opponent_name', payload: { type: 'opponent_name', name: username ?? 'Unknown', elo: elo ?? null } })
        }
      })
  }, [machineMove, onStatusChange, pieces, userId, username])

  const startGame = useCallback((gameId: string, mySide: 'attacker' | 'defender') => {
    joinGameChannel(gameId, mySide)
    onStatusChange({ type: 'matched', gameId, opponentName: '' })
  }, [joinGameChannel, onStatusChange])

  const sendMove = useCallback((pieceId: string, toRow: number, toCol: number) => {
    if (!state.current.channel) return
    state.current.seq += 1
    state.current.channel.send({
      type: 'broadcast',
      event: 'move',
      payload: { type: 'move', seq: state.current.seq, pieceId, toRow, toCol },
    })
  }, [])

  const endGame = useCallback((winnerId: string | null) => {
    if (!state.current.gameId) return
    supabase.from('games').update({
      status: 'completed',
      winner_id: winnerId,
      ended_at: new Date().toISOString(),
    }).eq('id', state.current.gameId).eq('status', 'active')
    cleanup()
    onStatusChange({ type: 'ended' })
  }, [cleanup, onStatusChange])

  useEffect(() => () => cleanup(), [cleanup])

  return { startGame, sendMove, endGame }
}
