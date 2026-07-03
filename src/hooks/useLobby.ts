import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface Challenge {
  id: string
  host_id: string
  host_name: string
  host_side: 'attacker' | 'defender'
  rules: string
  board_size: number
  created_at: string
}

export function useLobby(
  userId: string | null,
  username: string | null,
  onGameStart: (gameId: string, mySide: 'attacker' | 'defender', rules: string, boardSize: number) => void
) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [myChallenge, setMyChallenge] = useState<Challenge | null>(null)
  const onGameStartRef = useRef(onGameStart)
  onGameStartRef.current = onGameStart

  const loadChallenges = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('challenges').select('*').order('created_at')
    if (data) {
      setMyChallenge(data.find((c: Challenge) => c.host_id === userId) ?? null)
      setChallenges(data.filter((c: Challenge) => c.host_id !== userId))
    }
  }, [userId])

  // Realtime challenges list
  useEffect(() => {
    if (!userId) return
    loadChallenges()
    const channel = supabase.channel('lobby-challenges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, loadChallenges)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, loadChallenges])

  // Realtime: host is notified when someone creates a game with them in it
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel('my-games')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games', filter: `attacker_id=eq.${userId}` },
        ({ new: game }) => onGameStartRef.current(game.id, 'attacker', game.rules, game.board_size)
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games', filter: `defender_id=eq.${userId}` },
        ({ new: game }) => onGameStartRef.current(game.id, 'defender', game.rules, game.board_size)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const hostChallenge = useCallback(async (rules: string, boardSize: number, side: 'attacker' | 'defender') => {
    if (!userId || !username) return
    await supabase.from('challenges').delete().eq('host_id', userId)
    const { data } = await supabase.from('challenges').insert({
      host_id: userId,
      host_name: username,
      host_side: side,
      rules,
      board_size: boardSize,
    }).select().single()
    if (data) setMyChallenge(data)
  }, [userId, username])

  const cancelChallenge = useCallback(async () => {
    if (!userId) return
    await supabase.from('challenges').delete().eq('host_id', userId)
    setMyChallenge(null)
  }, [userId])

  const acceptChallenge = useCallback(async (challenge: Challenge) => {
    if (!userId) return
    const mySide: 'attacker' | 'defender' = challenge.host_side === 'attacker' ? 'defender' : 'attacker'
    const attackerId = challenge.host_side === 'attacker' ? challenge.host_id : userId
    const defenderId = challenge.host_side === 'defender' ? challenge.host_id : userId

    // Atomically claim the challenge by deleting it first.
    // Only one concurrent acceptor will get a row back — the other gets nothing and bails.
    const { data: claimed, error: claimError } = await supabase
      .from('challenges').delete().eq('id', challenge.id).select().single()
    if (claimError) console.error('acceptChallenge: delete failed', claimError)
    if (!claimed) return // Another player got there first (or RLS blocked the delete)

    const { data: game, error } = await supabase.from('games').insert({
      attacker_id: attackerId,
      defender_id: defenderId,
      rules: challenge.rules,
      board_size: challenge.board_size,
      status: 'active',
    }).select().single()

    if (error || !game) { console.error('Failed to create game', error); return }

    onGameStartRef.current(game.id, mySide, challenge.rules, challenge.board_size)
  }, [userId])

  return { challenges, myChallenge, hostChallenge, cancelChallenge, acceptChallenge }
}
