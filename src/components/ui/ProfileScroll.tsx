import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGameSlice } from '../../store/gameStore'
import { randomAvatar } from '../../lib/avatarConfig'
import { AvatarDisplay } from './AvatarDisplay'
import { AvatarMaker } from './AvatarMaker'
import { ScrollPage } from './ScrollPage'

type StatRow = { opponent_type: string; result: string; rules: string; board_size: number; count: number }

export function ProfileScroll({ onClose, onSignIn, onPlayOnline }: { onClose: () => void; onSignIn: () => void; onPlayOnline: () => void }) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSaving, setNameSaving] = useState(false)
  const [stats, setStats] = useState<StatRow[]>([])
  const [editingAvatar, setEditingAvatar] = useState(false)
  const { userId, username, elo, avatar, setAuth, setUsername, setAvatar } = useGameSlice('userId', 'username', 'elo', 'avatar', 'setAuth', 'setUsername', 'setAvatar')

  useEffect(() => {
    if (!userId) return
    supabase
      .from('game_results')
      .select('opponent_type, result, rules, board_size')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) { console.error('game_results select:', error.message); return }
        if (!data) return
        const grouped = new Map<string, StatRow>()
        for (const row of data) {
          const key = `${row.rules}|${row.board_size}|${row.opponent_type}|${row.result}`
          const existing = grouped.get(key)
          if (existing) existing.count++
          else grouped.set(key, { ...row, count: 1 })
        }
        setStats([...grouped.values()])
      })
  }, [userId])
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setAuth(null, null)
    onClose()
  }
  const handleStartEdit = () => { setNameInput(username ?? ''); setNameError(null); setEditingName(true) }
  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed.length < 3) { setNameError('Must be at least 3 characters'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setNameError('Letters, numbers and underscores only'); return }
    setNameSaving(true); setNameError(null)
    const { error } = await supabase.from('profiles').upsert({ id: userId, username: trimmed })
    if (error) {
      setNameError(error.message.includes('unique') ? 'That name is taken' : error.message)
      setNameSaving(false); return
    }
    setUsername(trimmed)
    // Save avatar separately (column may not exist until migration 005 is run)
    const newAvatar = avatar ?? randomAvatar()
    await supabase.from('profiles').update({ avatar: newAvatar }).eq('id', userId)
    if (!avatar) setAvatar(newAvatar)
    setNameSaving(false)
    setEditingName(false)
  }
  const handleSaveAvatar = async (newConfig: import('../../lib/avatarConfig').AvatarConfig) => {
    if (!userId) return
    await supabase.from('profiles').update({ avatar: newConfig }).eq('id', userId)
      .then(({ error }) => { if (error) console.error('avatar save:', error.message) })
    setAvatar(newConfig)
    setEditingAvatar(false)
  }
  return (
    <ScrollPage title="Profile" onClose={onClose}>
      {userId ? (
        <>
          {editingAvatar && avatar && (
            <AvatarMaker initial={avatar} onSave={handleSaveAvatar} onCancel={() => setEditingAvatar(false)} />
          )}
          {!editingAvatar && <div className="profile-scroll__hero">
            {avatar && (
              <div className="profile-scroll__avatar-wrap">
                <AvatarDisplay config={avatar} size={96} circle />
                <button className="profile-scroll__edit-btn profile-scroll__avatar-edit" onClick={() => setEditingAvatar(true)}>Edit avatar</button>
              </div>
            )}
            {editingName ? (
              <div className="profile-scroll__edit-name">
                <input
                  className="auth-modal__input profile-scroll__name-input"
                  type="text"
                  value={nameInput}
                  onChange={e => { setNameInput(e.target.value); setNameError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                  maxLength={20}
                  autoFocus
                />
                {nameError && <p className="auth-modal__error">{nameError}</p>}
                <div className="profile-scroll__name-actions">
                  <button className="profile-scroll__btn profile-scroll__btn--primary" onClick={handleSaveName} disabled={nameSaving}>
                    {nameSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="profile-scroll__btn profile-scroll__btn--ghost" onClick={() => setEditingName(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="profile-scroll__name-row">
                <span className="profile-scroll__name">{username ?? 'Anonymous'}</span>
                <button className="profile-scroll__edit-btn" onClick={handleStartEdit}>Edit</button>
              </div>
            )}
            {elo !== null && (
              <div className="profile-scroll__elo">
                <span className="profile-scroll__elo-label">ELO Rating</span>
                <span className="profile-scroll__elo-value">{elo}</span>
              </div>
            )}
          </div>}
          <hr className="credits-page__rule" />
          {(() => {
            const totalW = stats.filter(s => s.result === 'win').reduce((a, s) => a + s.count, 0)
            const totalL = stats.filter(s => s.result === 'loss').reduce((a, s) => a + s.count, 0)
            const total = totalW + totalL
            const rate = total > 0 ? Math.round((totalW / total) * 100) : null
            const variants = [...new Map(stats.map(s => [`${s.rules}|${s.board_size}`, { rules: s.rules, board_size: s.board_size }])).values()]
              .sort((a, b) => a.rules.localeCompare(b.rules) || a.board_size - b.board_size)
            if (total === 0) return <p style={{ color: '#7a5228', fontStyle: 'italic', fontSize: '0.85em', margin: '8px 0' }}>No games recorded yet.</p>
            return (
              <div className="profile-scroll__section">
                <div className="profile-scroll__section-title">Record</div>
                <div className="profile-scroll__summary">
                  <span className="profile-scroll__summary-wins">{totalW}W</span>
                  <span className="profile-scroll__summary-sep">/</span>
                  <span className="profile-scroll__summary-losses">{totalL}L</span>
                  {rate !== null && <span className="profile-scroll__summary-rate">{rate}% win rate</span>}
                </div>
                {variants.map(({ rules: v, board_size: bs }) => (
                  <div key={`${v}|${bs}`} className="profile-scroll__stat-block">
                    <div className="profile-scroll__stat-label">{v} · {bs}×{bs}</div>
                    {(['machine', 'human'] as const).map(type => {
                      const w = stats.find(s => s.rules === v && s.board_size === bs && s.opponent_type === type && s.result === 'win')?.count ?? 0
                      const l = stats.find(s => s.rules === v && s.board_size === bs && s.opponent_type === type && s.result === 'loss')?.count ?? 0
                      if (w === 0 && l === 0) return null
                      return (
                        <div key={type} className="profile-scroll__stat-row">
                          <span className="profile-scroll__stat-type">{type === 'machine' ? 'vs Machine' : 'vs Players'}</span>
                          <span className="profile-scroll__stat-scores">
                            <span className="profile-scroll__stat-win">{w}W</span>
                            <span className="profile-scroll__stat-sep"> / </span>
                            <span className="profile-scroll__stat-loss">{l}L</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })()}
          <div className="profile-scroll__actions">
            <button className="profile-scroll__btn profile-scroll__btn--primary" onClick={onPlayOnline}>Play Online</button>
            <button className="profile-scroll__btn profile-scroll__btn--ghost" onClick={handleSignOut}>Log Out</button>
          </div>
          <p className="profile-scroll__elo-info">ELO: K=40 first 30 games · K=32 standard · K=16 above 2000 · repeat opponents capped at K=20</p>
        </>
      ) : (
        <>
          <p>Log in to track your wins, losses and rank on the leaderboard.</p>
          <button className="profile-scroll__btn profile-scroll__btn--primary" onClick={onSignIn}>Log In / Register</button>
        </>
      )}
    </ScrollPage>
  )
}
