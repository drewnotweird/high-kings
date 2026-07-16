import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGameSlice } from '../../store/gameStore'
import { ScrollPage } from './ScrollPage'

type LeaderboardRow = { id: string; username: string; elo: number; rank: number }

export function LeaderboardScroll({ onClose }: { onClose: () => void }) {
  const { userId } = useGameSlice('userId')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, username, elo')
      .not('username', 'is', null)
      .order('elo', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setRows(data.map((r, i) => ({ ...r, rank: i + 1 })))
        setLoading(false)
      }, () => setLoading(false))
  }, [])

  const myRank = rows.find(r => r.id === userId)?.rank ?? null

  return (
    <ScrollPage title="Ranks" onClose={onClose}>
      {loading ? (
        <p style={{ textAlign: 'center', color: '#706050', fontSize: 13 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#706050', fontSize: 13 }}>No ranked players yet. Play an online match to earn your first ELO.</p>
      ) : (
        <>
          {myRank !== null && (
            <p className="leaderboard__my-rank">Your rank <strong>#{myRank}</strong></p>
          )}
          <div className="leaderboard__table">
            <div className="leaderboard__header">
              <span className="leaderboard__col leaderboard__col--rank">#</span>
              <span className="leaderboard__col leaderboard__col--name">Player</span>
              <span className="leaderboard__col leaderboard__col--elo">ELO</span>
            </div>
            {rows.map(r => {
              const isTop3 = r.rank <= 3
              return (
                <div key={r.id} className={`leaderboard__row${isTop3 ? ' leaderboard__row--top3' : ''}${r.id === userId ? ' leaderboard__row--me' : ''}`}>
                  <span className={`leaderboard__col leaderboard__col--rank${isTop3 ? ` leaderboard__col--rank-${r.rank}` : ''}`}>
                    {r.rank}
                  </span>
                  <span className={`leaderboard__col leaderboard__col--name${isTop3 ? ' leaderboard__col--name-top3' : ''}`}>{r.username}</span>
                  <span className={`leaderboard__col leaderboard__col--elo${isTop3 ? ' leaderboard__col--elo-top3' : ''}`}>{r.elo}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </ScrollPage>
  )
}
