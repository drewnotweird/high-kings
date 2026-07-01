import type { Challenge } from '../../hooks/useLobby'

interface Props {
  challenges: Challenge[]
  myChallenge: Challenge | null
  draftRules: string
  draftBoardSize: number
  draftSide: 'attacker' | 'defender'
  onHost: () => void
  onCancel: () => void
  onAccept: (challenge: Challenge) => void
  onClose: () => void
}

export function LobbyPanel({ challenges, myChallenge, draftRules, draftBoardSize, draftSide, onHost, onCancel, onAccept, onClose }: Props) {
  return (
    <div className="lobby-backdrop" onClick={e => { if (e.target === e.currentTarget && !myChallenge) onClose() }}>
      <div className="lobby-panel">
        <div className="lobby-panel__header">
          <span className="lobby-panel__title">Game Lobby</span>
          {!myChallenge && <button className="lobby-panel__close" onClick={onClose}>✕</button>}
        </div>

        {myChallenge ? (
          <div className="lobby-panel__mine">
            <p className="lobby-panel__mine-label">Your challenge</p>
            <p className="lobby-panel__mine-detail">
              {myChallenge.rules} · {myChallenge.board_size}×{myChallenge.board_size} · You play <strong>{myChallenge.host_side}</strong>
            </p>
            <div className="lobby-panel__spinner" />
            <p className="lobby-panel__waiting">Waiting for opponent…</p>
            <button className="lobby-panel__cancel-btn" onClick={onCancel}>Cancel</button>
          </div>
        ) : (
          <div className="lobby-panel__host-row">
            <span className="lobby-panel__host-summary">
              {draftRules} · {draftBoardSize}×{draftBoardSize} · You play <strong>{draftSide}</strong>
            </span>
            <button className="lobby-panel__host-btn" onClick={onHost}>Host Challenge</button>
          </div>
        )}

        {challenges.length > 0 && (
          <div className="lobby-panel__list">
            {challenges.map(c => (
              <div key={c.id} className="lobby-panel__challenge">
                <div className="lobby-panel__challenge-info">
                  <span className="lobby-panel__challenge-host">{c.host_name}</span>
                  <span className="lobby-panel__challenge-detail">{c.rules} · {c.board_size}×{c.board_size}</span>
                  <span className="lobby-panel__challenge-side">
                    You play: <strong>{c.host_side === 'attacker' ? 'Defender' : 'Attacker'}</strong>
                  </span>
                </div>
                <button
                  className="lobby-panel__accept-btn"
                  disabled={!!myChallenge}
                  onClick={() => onAccept(c)}
                >Accept</button>
              </div>
            ))}
          </div>
        )}

        {!myChallenge && challenges.length === 0 && (
          <p className="lobby-panel__empty">No open challenges. Host one above.</p>
        )}
      </div>
    </div>
  )
}
