import { useEffect, useRef, useCallback } from 'react'
import { getSupabase } from '../lib/supabase'
import { useGameSlice, useGameStore } from '../store/gameStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type OnlineStatus =
  | { type: 'idle' }
  | { type: 'matched'; gameId: string; opponentName: string; opponentElo: number | null; opponentId: string | null }
  | { type: 'spectating'; gameId: string }
  | { type: 'opponent_disconnected'; secondsLeft: number }
  | { type: 'ended' }

// Rematch negotiation. Both players answer yes/no; the game only restarts when
// both said yes. A decline has to reach the other player, otherwise whoever
// said yes waits forever on "waiting for opponent".
export type RematchState =
  | { type: 'none' }        // not asked yet
  | { type: 'offered' }     // I said yes, waiting on them
  | { type: 'received' }    // they said yes, I haven't answered
  | { type: 'declined' }    // they said no
  | { type: 'unavailable' } // they left before answering

type MoveEvent = { type: 'move'; seq: number; pieceId: string; toRow: number; toCol: number }
type RematchStartEvent = { gameId: string }
type NameEvent = { type: 'opponent_name'; name: string; elo: number | null }
type ResyncEvent = { type: 'resync'; seq: number; pieces: unknown[] }

interface OnlineGameState {
  gameId: string | null
  mySide: 'attacker' | 'defender' | null
  opponentId: string | null
  seq: number
  disconnectTimer: ReturnType<typeof setTimeout> | null
  channel: RealtimeChannel | null
  // The channel is deliberately kept alive after the game ends so the two
  // clients can still negotiate a rematch. `finished` stops the post-game
  // presence-leave from starting the abandon countdown, which would otherwise
  // rewrite a completed game as abandoned with the wrong winner.
  finished: boolean
  iOffered: boolean
  theyOffered: boolean
}

export function useOnlineGame(
  onStatusChange: (status: OnlineStatus) => void,
  onRematchChange: (state: RematchState) => void = () => {},
  onRematchStart: (gameId: string, mySide: 'attacker' | 'defender', rules: string, boardSize: number) => void = () => {},
) {
  const { machineMove, setPieces, userId, username, elo } = useGameSlice('machineMove', 'setPieces', 'userId', 'username', 'elo')
  const state = useRef<OnlineGameState>({
    gameId: null,
    mySide: null,
    opponentId: null,
    seq: 0,
    disconnectTimer: null,
    channel: null,
    finished: false,
    iOffered: false,
    theyOffered: false,
  })

  const cleanup = useCallback(() => {
    if (state.current.disconnectTimer) clearInterval(state.current.disconnectTimer)
    state.current.disconnectTimer = null
    if (state.current.channel) {
      const ch = state.current.channel
      getSupabase().then(sb => sb.removeChannel(ch))
      state.current.channel = null
    }
  }, [])

  // Both players agreed. Only one may insert the new game row, so the player
  // with the lower user id creates it and broadcasts the id; the other waits.
  // Sides swap — the attacker/defender matchup is asymmetric, so a rematch on
  // the same sides isn't a fair return fixture.
  const agreeRematch = useCallback(async () => {
    const { gameId, mySide, opponentId } = state.current
    if (!gameId || !mySide || !opponentId || !userId) return
    if (userId > opponentId) return  // the other side creates it
    const sb = await getSupabase()
    const { data: prev } = await sb.from('games').select('rules, board_size').eq('id', gameId).single()
    if (!prev) { onRematchChange({ type: 'unavailable' }); return }
    const newSide: 'attacker' | 'defender' = mySide === 'attacker' ? 'defender' : 'attacker'
    const { data: game, error } = await sb.from('games').insert({
      attacker_id: newSide === 'attacker' ? userId : opponentId,
      defender_id: newSide === 'defender' ? userId : opponentId,
      rules: prev.rules,
      board_size: prev.board_size,
      status: 'active',
    }).select().single()
    if (error || !game) {
      console.error('rematch: could not create game', error?.message)
      onRematchChange({ type: 'unavailable' })
      return
    }
    state.current.channel?.send({
      type: 'broadcast', event: 'rematch_start', payload: { gameId: game.id },
    })
    onRematchStart(game.id, newSide, prev.rules, prev.board_size)
  }, [userId, onRematchChange, onRematchStart])

  // The other side created it — read the row to find out which side we're on.
  const joinRematch = useCallback(async (newGameId: string) => {
    if (!userId) return
    const sb = await getSupabase()
    const { data } = await sb.from('games')
      .select('attacker_id, rules, board_size').eq('id', newGameId).single()
    if (!data) { onRematchChange({ type: 'unavailable' }); return }
    const mySide: 'attacker' | 'defender' = data.attacker_id === userId ? 'attacker' : 'defender'
    onRematchStart(newGameId, mySide, data.rules, data.board_size)
  }, [userId, onRematchChange, onRematchStart])

  const joinGameChannel = useCallback((gameId: string, mySide: 'attacker' | 'defender', opponentId: string | null) => {
    state.current.gameId = gameId
    state.current.mySide = mySide
    state.current.opponentId = opponentId
    state.current.seq = 0
    state.current.finished = false
    state.current.iOffered = false
    state.current.theyOffered = false

    getSupabase().then(sb => {
    const channel = sb.channel(`game:${gameId}`, { config: { broadcast: { self: false } } })
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
          payload: { type: 'resync', seq: state.current.seq, pieces: useGameStore.getState().pieces },
        })
      })
      .on('broadcast', { event: 'opponent_name' }, ({ payload }: { payload: NameEvent }) => {
        onStatusChange({ type: 'matched', gameId, opponentName: payload.name, opponentElo: payload.elo ?? null, opponentId: state.current.opponentId })
      })
      .on('broadcast', { event: 'rematch_offer' }, () => {
        state.current.theyOffered = true
        // Both said yes — one side creates the game, the other waits for the id.
        if (state.current.iOffered) void agreeRematch()
        else onRematchChange({ type: 'received' })
      })
      .on('broadcast', { event: 'rematch_decline' }, () => {
        state.current.theyOffered = false
        onRematchChange({ type: 'declined' })
      })
      .on('broadcast', { event: 'rematch_start' }, ({ payload }: { payload: RematchStartEvent }) => {
        void joinRematch(payload.gameId)
      })
      .on('presence', { event: 'leave' }, () => {
        if (state.current.finished) {
          // Game already over — they've closed the tab rather than dropped mid-game.
          onRematchChange({ type: 'unavailable' })
          return
        }
        let secondsLeft = 30
        onStatusChange({ type: 'opponent_disconnected', secondsLeft })
        state.current.disconnectTimer = setInterval(() => {
          secondsLeft -= 1
          if (secondsLeft <= 0) {
            clearInterval(state.current.disconnectTimer!)
            state.current.disconnectTimer = null
            getSupabase().then(sb => sb.from('games').update({ status: 'abandoned', winner_id: userId, ended_at: new Date().toISOString() }).eq('id', gameId))
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
        onStatusChange({ type: 'matched', gameId, opponentName: '', opponentElo: null, opponentId: state.current.opponentId })
        channel.send({ type: 'broadcast', event: 'opponent_name', payload: { type: 'opponent_name', name: username ?? 'Unknown', elo: elo ?? null } })
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, username })
          channel.send({ type: 'broadcast', event: 'opponent_name', payload: { type: 'opponent_name', name: username ?? 'Unknown', elo: elo ?? null } })
        }
      })
    })
  }, [machineMove, onStatusChange, userId, username, elo, agreeRematch, joinRematch, onRematchChange])

  const startGame = useCallback(async (gameId: string, mySide: 'attacker' | 'defender') => {
    // Fetch the game record to get the opponent's real user ID so losses record the correct winner
    let opponentId: string | null = null
    const { data } = await (await getSupabase()).from('games').select('attacker_id, defender_id').eq('id', gameId).single()
    if (data) opponentId = mySide === 'attacker' ? data.defender_id : data.attacker_id
    joinGameChannel(gameId, mySide, opponentId)
    onStatusChange({ type: 'matched', gameId, opponentName: '', opponentElo: null, opponentId })
  }, [joinGameChannel, onStatusChange])

  const watchGame = useCallback((gameId: string) => {
    cleanup()
    state.current.gameId = gameId
    state.current.mySide = null
    state.current.seq = 0

    getSupabase().then(sb => {
    const channel = sb.channel(`game:${gameId}`, { config: { broadcast: { self: false } } })
    state.current.channel = channel

    channel
      .on('broadcast', { event: 'move' }, ({ payload }: { payload: MoveEvent }) => {
        machineMove(payload.pieceId, payload.toRow, payload.toCol)
        state.current.seq = payload.seq
      })
      .on('broadcast', { event: 'resync' }, ({ payload }: { payload: ResyncEvent }) => {
        if (payload.pieces) setPieces(payload.pieces as any)
        state.current.seq = payload.seq
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'resync_request', payload: { type: 'resync_request' } })
        }
      })
    })

    onStatusChange({ type: 'spectating', gameId })
  }, [cleanup, machineMove, setPieces, onStatusChange])

  const offerRematch = useCallback(() => {
    if (!state.current.channel) { onRematchChange({ type: 'unavailable' }); return }
    state.current.iOffered = true
    state.current.channel.send({ type: 'broadcast', event: 'rematch_offer', payload: {} })
    if (state.current.theyOffered) void agreeRematch()
    else onRematchChange({ type: 'offered' })
  }, [agreeRematch, onRematchChange])

  const declineRematch = useCallback(() => {
    state.current.iOffered = false
    state.current.channel?.send({ type: 'broadcast', event: 'rematch_decline', payload: {} })
    cleanup()
    onRematchChange({ type: 'none' })
  }, [cleanup, onRematchChange])

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
    const gid = state.current.gameId
    getSupabase().then(sb => sb.from('games').update({
      status: 'completed',
      winner_id: winnerId,
      ended_at: new Date().toISOString(),
    }).eq('id', gid).eq('status', 'active')
      .then(({ error }) => { if (error) console.error('endGame update failed:', error.message) }))
    // Deliberately no cleanup() here: the channel has to outlive the game so
    // the two clients can offer/decline a rematch. It is torn down by
    // declineRematch, leaveGame, or unmount.
    state.current.finished = true
    if (state.current.disconnectTimer) clearInterval(state.current.disconnectTimer)
    state.current.disconnectTimer = null
    onStatusChange({ type: 'ended' })
  }, [cleanup, onStatusChange])

  useEffect(() => () => cleanup(), [cleanup])

  const stopWatching = useCallback(() => { cleanup() }, [cleanup])

  const leaveGame = useCallback(() => { cleanup(); onRematchChange({ type: 'none' }) }, [cleanup, onRematchChange])

  return { startGame, watchGame, stopWatching, sendMove, endGame, offerRematch, declineRematch, leaveGame }
}
