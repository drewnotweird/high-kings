import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store/gameStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type OnlineStatus =
  | { type: 'idle' }
  | { type: 'searching' }
  | { type: 'matched'; gameId: string; opponentName: string }
  | { type: 'opponent_disconnected'; secondsLeft: number }
  | { type: 'ended' }

type MoveEvent = { type: 'move'; seq: number; pieceId: string; toRow: number; toCol: number }


interface OnlineGameState {
  gameId: string | null
  mySide: 'attacker' | 'defender' | null
  seq: number
  pollInterval: ReturnType<typeof setInterval> | null
  disconnectTimer: ReturnType<typeof setTimeout> | null
  channel: RealtimeChannel | null
}

export function useOnlineGame(
  onStatusChange: (status: OnlineStatus) => void,
) {
  const { machineMove, setPlayerMode, resetGame, setSetting, pieces, userId, username } = useGameStore()
  const state = useRef<OnlineGameState>({
    gameId: null,
    mySide: null,
    seq: 0,
    pollInterval: null,
    disconnectTimer: null,
    channel: null,
  })

  const cleanup = useCallback(() => {
    if (state.current.pollInterval) clearInterval(state.current.pollInterval)
    if (state.current.disconnectTimer) clearTimeout(state.current.disconnectTimer)
    state.current.pollInterval = null
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
      .on('broadcast', { event: 'opponent_name' }, ({ payload }: { payload: { type: string; name: string } }) => {
        onStatusChange({ type: 'matched', gameId, opponentName: payload.name })
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
        // Opponent reconnected
        if (state.current.disconnectTimer) {
          clearInterval(state.current.disconnectTimer)
          state.current.disconnectTimer = null
        }
        onStatusChange({ type: 'matched', gameId, opponentName: '' })
        // Announce name again
        channel.send({ type: 'broadcast', event: 'opponent_name', payload: { type: 'opponent_name', name: username ?? 'Unknown' } })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, username })
          channel.send({ type: 'broadcast', event: 'opponent_name', payload: { type: 'opponent_name', name: username ?? 'Unknown' } })
        }
      })
  }, [machineMove, onStatusChange, pieces, userId, username])

  const findMatch = useCallback(async (matchRules: string, matchBoardSize: number) => {
    if (!userId) return
    onStatusChange({ type: 'searching' })

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return

    const handleMatched = (gameId: string, side: 'attacker' | 'defender') => {
      if (state.current.pollInterval) clearInterval(state.current.pollInterval)
      state.current.pollInterval = null
      // Apply settings and reset board only now that a match is confirmed
      setSetting('rules', matchRules as never)
      setSetting('boardSize', matchBoardSize as never)
      setPlayerMode(side)
      resetGame()
      joinGameChannel(gameId, side)
      onStatusChange({ type: 'matched', gameId, opponentName: '' })
    }

    const poll = async () => {
      // Stop polling if user already cancelled
      if (!state.current.pollInterval) return
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/matchmaking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: matchRules, board_size: matchBoardSize }),
      })
      const data = await res.json()
      if (data.status === 'matched') handleMatched(data.game_id, data.side)
    }

    // Initial call
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/matchmaking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: matchRules, board_size: matchBoardSize }),
    })
    const data = await res.json()

    if (data.status === 'matched') {
      handleMatched(data.game_id, data.side)
    } else if (data.status === 'waiting') {
      state.current.pollInterval = setInterval(poll, 3000)
      // Auto-cancel after 5 minutes
      setTimeout(() => {
        if (state.current.pollInterval) {
          clearInterval(state.current.pollInterval)
          state.current.pollInterval = null
          cancelSearch()
          onStatusChange({ type: 'idle' })
        }
      }, 5 * 60 * 1000)
    }
  }, [userId, setSetting, setPlayerMode, resetGame, joinGameChannel, onStatusChange])

  const cancelSearch = useCallback(async () => {
    if (state.current.pollInterval) {
      clearInterval(state.current.pollInterval)
      state.current.pollInterval = null
    }
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (token) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/matchmaking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
    }
    onStatusChange({ type: 'idle' })
  }, [onStatusChange])

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

  return { findMatch, cancelSearch, sendMove, endGame }
}
