import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface Challenge {
  id: string
  host_id: string
  host_name: string
  host_side: 'attacker' | 'defender'
  rules: string
  board_size: number
  created_at: string
}

export interface ActiveGame {
  id: string
  attacker_name: string
  defender_name: string
  rules: string
  board_size: number
  started_at: string
}

export function useLobby(
  userId: string | null,
  username: string | null,
  onGameStart: (gameId: string, mySide: 'attacker' | 'defender', rules: string, boardSize: number) => void
) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [lobbyError, setLobbyError] = useState<string | null>(null)
  const [myChallenge, setMyChallenge] = useState<Challenge | null>(null)
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([])
  const onGameStartRef = useRef(onGameStart)
  onGameStartRef.current = onGameStart

  const loadChallenges = useCallback(async () => {
    if (!userId) return
    const { data } = await (await getSupabase()).from('challenges').select('*').order('created_at')
    if (data) {
      setMyChallenge(data.find((c: Challenge) => c.host_id === userId) ?? null)
      setChallenges(data.filter((c: Challenge) => c.host_id !== userId))
    }
  }, [userId])

  const loadActiveGames = useCallback(async () => {
    const now = Date.now()
    const displayCutoff = new Date(now - 3 * 60 * 60 * 1000).toISOString()
    const abandonCutoff = new Date(now - 4 * 60 * 60 * 1000).toISOString()

    // Mark games older than 4 hours that are still 'active' as abandoned
    getSupabase().then(sb => sb
      .from('games')
      .update({ status: 'abandoned', ended_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('started_at', abandonCutoff)
      .then(({ error }) => { if (error) console.error('stale game cleanup:', error.message) }))

    const { data } = await (await getSupabase())
      .from('games')
      .select('id, rules, board_size, started_at, attacker:attacker_id(username), defender:defender_id(username)')
      .eq('status', 'active')
      .gte('started_at', displayCutoff)
      .order('started_at')
    if (data) {
      setActiveGames(data.map((g: any) => ({
        id: g.id,
        attacker_name: g.attacker?.username ?? '?',
        defender_name: g.defender?.username ?? '?',
        rules: g.rules,
        board_size: g.board_size,
        started_at: g.started_at,
      })))
    }
  }, [])

  // Realtime challenges + active games
  useEffect(() => {
    if (!userId) return
    loadChallenges()
    loadActiveGames()
    let channel: RealtimeChannel | null = null
    let cancelled = false
    getSupabase().then(sb => {
      if (cancelled) return
      channel = sb.channel('lobby-challenges')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, loadChallenges)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, loadActiveGames)
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) getSupabase().then(sb => sb.removeChannel(channel!))
    }
  }, [userId, loadChallenges, loadActiveGames])

  // Realtime: host is notified when someone creates a game with them in it
  useEffect(() => {
    if (!userId) return
    let channel: RealtimeChannel | null = null
    let cancelled = false
    getSupabase().then(sb => {
      if (cancelled) return
      channel = sb.channel('my-games')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'games', filter: `attacker_id=eq.${userId}` },
          ({ new: game }) => onGameStartRef.current(game.id, 'attacker', game.rules, game.board_size)
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'games', filter: `defender_id=eq.${userId}` },
          ({ new: game }) => onGameStartRef.current(game.id, 'defender', game.rules, game.board_size)
        )
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) getSupabase().then(sb => sb.removeChannel(channel!))
    }
  }, [userId])

  const hostChallenge = useCallback(async (rules: string, boardSize: number, side: 'attacker' | 'defender') => {
    if (!userId || !username) return
    await (await getSupabase()).from('challenges').delete().eq('host_id', userId)
    setLobbyError(null)
    const { data, error } = await (await getSupabase()).from('challenges').insert({
      host_id: userId,
      host_name: username,
      host_side: side,
      rules,
      board_size: boardSize,
    }).select().single()
    if (error || !data) {
      console.error('hostChallenge:', error?.message)
      setLobbyError("Couldn't post your challenge. Check your connection and try again.")
      return
    }
    setMyChallenge(data)
  }, [userId, username])

  const cancelChallenge = useCallback(async () => {
    if (!userId) return
    await (await getSupabase()).from('challenges').delete().eq('host_id', userId)
    setMyChallenge(null)
  }, [userId])

  const acceptChallenge = useCallback(async (challenge: Challenge) => {
    if (!userId) return
    const mySide: 'attacker' | 'defender' = challenge.host_side === 'attacker' ? 'defender' : 'attacker'
    const attackerId = challenge.host_side === 'attacker' ? challenge.host_id : userId
    const defenderId = challenge.host_side === 'defender' ? challenge.host_id : userId

    // Atomically claim the challenge by deleting it first.
    // Only one concurrent acceptor will get a row back — the other gets nothing and bails.
    const { data: claimed, error: claimError } = await (await getSupabase())
      .from('challenges').delete().eq('id', challenge.id).select().single()
    setLobbyError(null)
    if (claimError) console.error('acceptChallenge: delete failed', claimError)
    if (!claimed) {
      // Another player got there first (or RLS blocked the delete). Either way
      // the click did nothing visible before this.
      setLobbyError('That challenge was already taken.')
      return
    }

    const { data: game, error } = await (await getSupabase()).from('games').insert({
      attacker_id: attackerId,
      defender_id: defenderId,
      rules: challenge.rules,
      board_size: challenge.board_size,
      status: 'active',
    }).select().single()

    if (error || !game) {
      console.error('Failed to create game', error)
      // The challenge was already deleted to claim it, so bailing here would
      // destroy it for everyone and start nothing. Put it back.
      const restored: Partial<Challenge> = { ...challenge }
      delete restored.id   // let the table mint a fresh one
      await (await getSupabase()).from('challenges').insert(restored)
      setLobbyError("Couldn't start that game. The challenge has been put back.")
      return
    }

    onGameStartRef.current(game.id, mySide, challenge.rules, challenge.board_size)
  }, [userId])

  return { challenges, myChallenge, activeGames, hostChallenge, cancelChallenge, acceptChallenge, lobbyError, clearLobbyError: () => setLobbyError(null) }
}
